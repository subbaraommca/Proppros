# API/data contract — <project> — v<N>
Agreed by: Frontend Engineer <date> · Backend Engineer <date>
Ownership: Frontend owns app/(ui files); Backend owns app/api/**, lib/server/**, data/**
Endpoint: POST /api/<name>
Request JSON: { field: type, required?, limits }
Responses: 200 {…} · 400 {error, fields} · 409/200 duplicate (idempotency key) · 500 {error}
Storage: local file/SQLite | labeled fixture (MOCK)
Checks: curl examples + expected status
