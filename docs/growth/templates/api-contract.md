# API contract — <feature> — v<N>

Agreed by: Frontend Engineer <date> · Backend Engineer <date>
Ownership: Frontend owns `frontend/src/**`; Backend owns `backend/app/**` and `backend/alembic/**`.

- **Endpoint:** `POST /api/<name>`
- **Request JSON:** `{ field: type, required?, limits }`
- **Responses:** 200 `{…}` · 400 `{detail}` · 409 duplicate (idempotency) · 429 rate limited · 500
- **Storage:** table / none
- **Checks:** pytest names, plus curl examples with the expected status
