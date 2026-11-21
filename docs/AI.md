# MaybeLater — AI Understanding (Stage 07)

AI suggests a title, a summary, why you might have saved something, a category, tags and (only when the item mentions it) when to bring it back. It is an assistant: every suggestion is marked, editable and optional, and nothing it does can overwrite what you decided.

## Pipeline

```text
capture saved (201) ─▶ background: run_analysis(item)
                         ├─ reload item (deleted? stop)
                         ├─ links: fetch_page_metadata (SSRF-safe: title, description, site name only)
                         ├─ provider.structured(system prompt v1, fenced item, IntentionAnalysisOutput)
                         ├─ store run: provider, model, prompt_version, validated output
                         └─ apply_suggestions: only fields whose state is absent or "suggested"
                       failure ─▶ analysis_status = failed + error code; the capture is untouched
```

| Part | File |
|---|---|
| Output schema (validated twice: strict JSON schema at the provider, Pydantic here) | `app/services/ai/schemas.py` |
| Versioned prompt (`capture-understanding-v1`) and input fencing | `app/services/ai/prompts.py` |
| Provider boundary and the Gemini implementation | `app/services/ai/provider.py` |
| Safe page metadata | `app/services/page_metadata.py` |
| Analysis run and applying suggestions | `app/services/analysis.py` |

## The provider (Google Gemini)

- **Model and SDK:** `GEMINI_MODEL`, default `gemini-3.8-flash`, through the `google-genai` SDK (2.34.0).
- **Call:** `client.aio.models.generate_content(model, contents, config)`, where `config` sets `system_instruction`, `response_mime_type="application/json"`, `response_schema` and `temperature=0.2`.
  - The answer is validated again with the strict Pydantic model, from `response.parsed` or else the JSON text.
  - The schema sent to Gemini is a copy without `additionalProperties`, which not every Gemini API version accepts. The strict validation afterwards still rejects unknown fields.
- **Fallback model:** `GEMINI_FALLBACK_MODEL`, default `gemini-2.5-flash`; empty turns it off.
  - The main model gets one attempt with a deadline of `GEMINI_MAIN_TIMEOUT_SECONDS` (default 15).
  - If it is overloaded (503), past its deadline (504 or our timeout) or out of quota (429), the fallback takes the same request with the usual retries.
  - A bad key, an unknown model or a malformed answer does not trigger the fallback.
  - Each run records the model that actually answered in `intention_analyses.model`.
  - Live check, 2026-11-21: the key works; `gemini-3.8-flash` (and the other 3.x Flash models) answered "deadline exceeded" or "high demand", and the fallback `gemini-2.5-flash` produced validated suggestions in about 2 s.
- **Timeouts and retries:** each attempt has a deadline of `AI_TIMEOUT_SECONDS` (default 30). Our retries (tenacity, 3 attempts, exponential backoff) cover only transient failures: timeouts, connection errors, 429 and 5xx. Other 4xx errors (a bad key, an unknown model) are not retried.
- **Errors become codes stored on the run:**

  | Failure | Code |
  |---|---|
  | Timeout | `provider_timeout` |
  | Rate limit | `provider_rate_limited` |
  | Outage or rejected request | `provider_unavailable` |
  | Safety block, empty answer or invalid JSON or shape | `provider_bad_output` |
  | No key | `provider_not_configured` (503) |

- **Data use:** Gemini API terms differ between the free and paid tiers. On the free tier, Google may use prompts to improve its products. Use a paid (billing-enabled) key for real users' content.
- **Swapping providers:** implement `AIProvider.structured()` and return the new provider from `get_ai_provider()`.

## Prompt safety

- Captured content, the owner's note and page metadata are wrapped in `<saved_item>`, `<owner_note>` and `<page_metadata>`. Any closing or opening tag inside the data is escaped, so content cannot break out of its fence.
- The system prompt says everything inside the tags is data, never instructions, and names typical injection phrasing. A test feeds an injection attempt through the fence.
- The prompt also asks for concise, factual summaries, forbids invented dates, prices, availability or facts, and asks for empty values or null when the source does not support a field. Intent is phrased as a possibility ("Possibly to …"), never stated as fact.
- **No raw content in logs:** analysis logs carry the item id and an error code only.

## Page metadata for links (SSRF-safe)

- Before each request, including every redirect hop (at most 3), `resolve_public_url` resolves the host and requires every address to be public. Localhost, private ranges, link-local and cloud metadata addresses are refused.
- Limits: 5 seconds overall, 512 KB read, HTML only. No cookies or credentials are sent, so pages behind a login or paywall are never fetched through; a 403 or a login page simply yields nothing.
- Only the title, description and site name are kept, and only for the prompt. The page body is discarded and never stored or logged. Any failure means "work from the URL alone".
- **Known limitation:** the DNS check and the connection resolve separately, so a fast DNS-rebinding host could in theory switch addresses in between. Pinning the connection to the checked IP is a hardening task for stage 14.

## Never overwriting the user

`intentions.field_states` records who stands behind each value.

| State | Meaning | Can AI write it? |
|---|---|---|
| absent | Nobody has decided (for example the provisional title made at capture) | Yes |
| `suggested` | An AI suggestion awaiting a decision | Yes (refreshed on re-analysis) |
| `accepted` | The user kept the suggestion | No |
| `edited` | The user wrote their own value | No |
| `dismissed` | The user said "not this"; the value is cleared | No (never suggested again) |

Empty answers never clear a value, and a category slug the database does not know is ignored, never created.

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/ai/analyze` | `{intention_id}`. Returns 202 at once with `analysis_status: "pending"`, used for retry or fresh suggestions. 409 if already pending, 503 without a key, 404 for another user's item. Rate limit: 10 per minute per user. |
| POST | `/api/v1/intentions/{id}/suggestions/{field}` | `{action: "accept" \| "dismiss"}`. 409 when the field holds no suggestion. |
| GET | `/api/v1/intentions/{id}` | Adds `suggestion_confidence` (0–1) from the latest successful run |

## Interface

- **Inbox:** rows say "Reading it" while pending and "No suggestions" after a failure. The list refreshes every 2.5 s while anything is pending.
- **Item page:** the Suggestions panel lists suggested fields (dashed, sage wash, "Suggested") and kept ones (solid, "Confirmed").
  - Each field offers **Keep** and **Not this**, plus **Edit** for free-text fields. Category and tags are changed in the details form.
  - A pending item shows "Reading what you saved… Your item is already safe" and refreshes itself.
  - A failed item says the item is saved as written and offers **Try suggestions again**.
  - With no AI key, the page says suggestions are not switched on.
- **Confidence:** never shown as a number or a guarantee. Below 0.5 the panel says "These are rough guesses from very little to go on".

## Turning it on

Set `GEMINI_API_KEY` in `backend/.env`. `GEMINI_MODEL` defaults to `gemini-3.8-flash`. Check it with `python scripts/check_ai.py` from `backend/`, which sends one sample item and prints the validated suggestions. Then restart the API; the start-up panel shows "AI configured · Gemini …".

Items saved while AI was off stay `off`. Re-analysis of an existing item is a deliberate action, so nothing is sent to the provider without the user asking.

## Tests

| File | Covers |
|---|---|
| `backend/tests/test_ai.py` (28) | Output cleaning and rejection of malformed output. Prompt fencing against injection. Provider with a mocked Gemini client: success and the config sent, JSON text fallback, blocked or empty output, malformed JSON, out-of-range output, timeouts retried then reported, our own deadline, transient 5xx then success, rate limit (429), outage, no retry on 403. Metadata parsing, safe redirects, a redirect to a metadata IP refused, non-HTML, 403, too many redirects. Against the database: suggestions applied and marked; the prompt includes the item and categories; unknown category ignored; **re-analysis keeps edited, accepted and dismissed fields**; accept and dismiss (409 when already decided); retry after failure; cross-user 404; 503 without a key. |
| `backend/tests/test_capture.py` | Capture still succeeds when the provider fails; analysis of a deleted item does nothing |
| `frontend/src/features/ai/ai-suggestion-panel.test.tsx` | Suggested vs confirmed shown in words; keep, dismiss and edit; Edit only on free text; rough-guesses note without a score; retry; pending state |
| `frontend/src/features/intentions/suggestions.test.ts` | Which fields appear for review, labels, and editability |

**Live check:** `python scripts/check_ai.py` (venv active) ran successfully on 2026-11-21: answers came from the fallback `gemini-2.5-flash` while `gemini-3.8-flash` was overloaded. Link previews are skipped for sites that refuse automated requests (Wikipedia and BBC answered 403), and analysis then works from the URL alone.
