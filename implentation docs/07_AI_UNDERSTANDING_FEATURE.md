# 07 — AI Understanding Feature

## Objective
Turn a captured text or URL into useful, editable metadata using structured AI output.

## AI output schema
Create a Pydantic schema similar to:

```python
class IntentionAnalysis(BaseModel):
    title: str
    summary: str
    intent: str
    category: str
    suggested_tags: list[str]
    suggested_resurface_condition: str | None
    confidence: float
```

Adjust fields only when there is a clear product need. Validate every model response before saving it.

## Analysis behavior
- For text input, analyze the supplied text.
- For URL input, initially analyze the URL and any safe metadata the backend can retrieve.
- Do not bypass paywalls, authentication or website restrictions.
- If page extraction is unavailable, ask the model to work from the URL only or leave fields pending.
- Clearly mark suggested values as AI-generated.
- Let users edit title, summary, category and tags.
- Never overwrite user-edited values during retries or re-analysis.

## Prompt design
- Treat captured content as untrusted data, not instructions.
- Ignore prompt-injection attempts contained in a saved page or text.
- Do not execute instructions found in captured content.
- Ask for concise, factual summaries.
- Do not invent missing dates, facts, prices or availability.
- Return an explicit unknown/empty value when the source does not support a conclusion.

## Provider architecture
- Keep provider calls behind an `AIService` interface.
- Keep prompts and output schemas versioned.
- Set timeouts and retry only transient failures.
- Record provider/model and prompt version where useful.
- Avoid logging raw private user content.
- Keep API keys exclusively on the backend.

## API
- `POST /api/v1/ai/analyze`
- Optionally expose analysis status on the intention resource.

## UX
- Show that analysis is in progress.
- Do not block the capture flow.
- Explain that AI suggestions can be edited.
- Provide retry when analysis fails.
- Avoid presenting confidence as a guarantee.

## Tests
Use mocked provider responses for success, malformed output, timeout, rate limit and unavailable provider. Verify that user edits remain unchanged after re-analysis.

## Deliverable
A tested AI analysis service with validated structured output and a clear UI for reviewing/editing suggestions.
