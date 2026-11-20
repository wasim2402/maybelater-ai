# 01 — Product Requirements

## Objective
Define the first useful version of MaybeLater before implementation. Build a focused personal intention manager, not a general-purpose project management platform.

## Problem
People save links, ideas, places, products and tasks in scattered apps or browser tabs. They often forget why they saved them or fail to return to them at the right time.

## Target users
- People who frequently save links, ideas, places, products or future tasks.
- Busy people who want a lightweight external memory.
- Curious users who collect things to explore later.
- Users who want gentle reminders rather than another demanding task list.

Do not assume a single profession, age group or productivity methodology.

## Product promise
“Save it now. MaybeLater will help you remember it when it matters.”

## Core user journey
1. User captures a URL or a text thought.
2. MaybeLater stores the original content immediately.
3. AI optionally extracts a title, short summary, intent, category and suggested context.
4. User reviews or edits the suggestions.
5. Item appears in the user's library/inbox.
6. The system may suggest a resurfacing condition or reminder.
7. User can open, snooze, edit, complete, archive or delete the item.

## MVP requirements
### Must have
- Account creation and login.
- Capture text and URLs.
- Personal inbox/library.
- Item detail and editing.
- AI title/summary/intent/category suggestions.
- Search and basic filters.
- User-controlled reminder creation.
- Resurface list based on explicit dates and simple rules.
- Complete, archive, snooze and delete actions.
- Responsive design and accessible controls.

### Later, not MVP blockers
- Voice capture.
- Screenshot/image understanding.
- Browser extension.
- Email forwarding.
- Calendar integrations.
- Social sharing and collaboration.
- Complex autonomous agents.
- Multi-channel notification delivery.

## User stories
- As a user, I can quickly save a thought without filling out a long form.
- As a user, I can save a URL and return to its original destination.
- As a user, I can see why I saved an item.
- As a user, I can correct AI-generated details.
- As a user, I can search and filter my saved items.
- As a user, I can choose when an item should remind me.
- As a user, I can snooze or dismiss a resurfaced item.
- As a user, I can delete my data.

## Non-goals
- Do not turn every saved item into a task.
- Do not schedule reminders without user consent.
- Do not make autonomous purchases, bookings, messages or external changes.
- Do not scrape restricted content or bypass website access controls.
- Do not present AI guesses as verified facts.

## Product principles
1. Capture should take seconds.
2. The original item must never be lost when AI fails.
3. AI is an assistant, not the owner of the user's data.
4. Resurfacing should be relevant and respectful.
5. The interface should remain calm and uncluttered.
6. The user must be able to inspect, edit and delete stored information.

## Success indicators for MVP
Track product events such as capture completed, analysis completed, item edited, reminder created, item resurfaced, item snoozed and item completed. Avoid collecting unnecessary sensitive content in analytics.

## Deliverable
Create a concise product requirements summary in the repository and confirm that each MVP requirement maps to a screen, API operation and test.
