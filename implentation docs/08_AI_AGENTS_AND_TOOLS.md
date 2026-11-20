# 08 — AI Agents and Tools

## Objective
Define a safe, modular agent architecture for MaybeLater. Do not introduce a multi-agent framework just for novelty. The MVP can use deterministic backend workflows plus focused LLM calls. Add agent orchestration only where it provides measurable value.

## Agent philosophy
Agents assist with understanding and retrieval. They do not own user data, make irreversible decisions or schedule unapproved reminders.

## Proposed agents (incremental)

### 1. Capture Understanding Agent
**Purpose:** Understand newly captured text or a URL.

Inputs:
- User-owned intention ID.
- Original capture text/URL.
- Allowed extracted page metadata, if available.

Outputs:
- Suggested title.
- Short summary.
- Intent.
- Category and tags.
- Optional suggested resurfacing condition.
- Confidence/uncertainty.

Tools:
- Read the specific captured item.
- Read safe page metadata supplied by the backend.
- Save validated analysis fields through a backend service.

Restrictions:
- Cannot delete or publish content.
- Cannot access another user's records.
- Cannot create reminders.
- Must treat captured content as untrusted input.

### 2. Organization Assistant
**Purpose:** Help users find and organize saved intentions.

Possible capabilities:
- Suggest categories and tags.
- Explain why two items may be related.
- Suggest a collection.
- Interpret a natural-language search query.

Tools:
- Search the current user's intentions.
- Read permitted item metadata.
- Propose category/tag changes.

Restrictions:
- Do not move, archive or delete items without user confirmation.
- Do not change user-edited fields silently.

### 3. Resurfacing Assistant
**Purpose:** Help identify items that may be relevant again.

Possible signals:
- User-selected due date.
- User-selected context or condition.
- Explicit snooze date.
- User's chosen location/context if the product later supports it.
- Recent user interaction with the item.

Outputs:
- Candidate intention IDs.
- Short reason each item may be relevant.
- Suggested next action.

Restrictions:
- The backend rules engine determines eligibility.
- The assistant may rank or explain candidates but cannot invent due dates.
- No notification is sent without a user-approved reminder or preference.

### 4. Personal Search Assistant (later)
**Purpose:** Translate natural-language questions into safe searches over the user's own library.

Example: “Show me the places I saved for a trip.”

Restrictions:
- Search only the authenticated user's data.
- Use structured filters or parameterized database queries.
- Never generate and execute arbitrary SQL.

## Tool design
Expose narrow, typed tools rather than unrestricted database or shell access. Each tool must:
- Validate input.
- Derive user identity from authenticated server context.
- Enforce resource ownership.
- Return the minimum data required.
- Have explicit read/write behavior.
- Log safe audit metadata.

## Orchestration
Start with a deterministic workflow:
1. Backend receives a request.
2. Backend checks authentication and ownership.
3. Relevant service gathers minimum required context.
4. LLM returns structured output.
5. Backend validates output.
6. User reviews proposed changes when needed.
7. Backend persists approved changes.

Use LangGraph only if later workflows need durable state, branching, retries or multi-step tool orchestration. Do not install it for the initial single-call analysis feature.

## Human approval rules
- AI may suggest metadata.
- AI may suggest a reminder time.
- User must approve reminder creation.
- User confirmation is required for destructive or externally visible actions.
- AI must never claim an action succeeded until the backend confirms it.

## Observability and evaluation
- Version prompts and schemas.
- Test against a curated set of sample captures.
- Evaluate extraction accuracy and hallucination rate.
- Track tool failures and latency.
- Do not retain sensitive prompt content in logs by default.

## Deliverable
Implement only the Capture Understanding Agent initially. Document the interfaces for later agents, but do not build unused agents or pretend they are active.
