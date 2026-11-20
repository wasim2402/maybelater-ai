# 05 — Authentication and User Accounts

## Objective
Provide secure account creation, login, session handling and user-owned data access.

## Authentication approach
Use Better Auth for the web authentication experience, following its current official setup documentation. The FastAPI API must independently verify the credential/session presented by the browser using a documented, secure shared-secret or public-key approach compatible with the selected Better Auth configuration.

Do not assume that a frontend session automatically authenticates API requests. Verify the exact integration before implementation.

## Required flows
- Sign up.
- Login.
- Logout.
- Session restoration on refresh.
- Protected application routes.
- Unauthenticated redirect.
- Account settings.
- Account deletion/data export policy placeholder if full implementation is out of MVP scope.

## Security requirements
- Use secure, HTTP-only cookies where supported by the chosen session design.
- Configure SameSite and Secure attributes appropriately for each environment.
- Protect state-changing requests against CSRF according to the chosen cookie/session architecture.
- Never store plaintext passwords.
- Do not put session secrets in `NEXT_PUBLIC_*` variables.
- Validate sessions on the backend for every protected API request.
- Enforce user ownership in every user-owned resource query.
- Rate-limit login and account recovery endpoints.
- Avoid revealing whether an email address has an account in sensitive authentication responses.

## Authorization
The authenticated identity must be derived from the verified session/token, not from a user ID sent by the client.

## UX
- Keep login and signup forms simple.
- Provide clear validation and error states.
- Preserve form input when safe to do so.
- Make logout and session-expired states understandable.

## Tests
- Unauthenticated API requests are rejected.
- User A cannot read, update or delete User B's resources.
- Session expires and logout invalidates access as designed.
- Invalid and expired credentials are rejected.
- Protected pages behave correctly after refresh.

## Deliverable
Implement and test the end-to-end authentication flow. Document local callback URLs and required environment variables without committing secrets.
