# Laravel code review checklist

Use this as a starting point and adapt it to the application. Mark non-applicable items N/A, and distinguish blockers from optional suggestions.

## Purpose and behaviour
- [ ] I understand the user outcome, acceptance criteria and scope of the change.
- [ ] I can identify the happy path and relevant failure or edge cases.

## Access and input
- [ ] Routes require the intended authentication and check permissions on the server.
- [ ] Every read and write is scoped to the correct tenant or owner; related IDs are checked too.
- [ ] Request values are validated and only intended fields are written.
- [ ] Output escaping, uploads, raw SQL and secrets are handled safely.

## Data and performance
- [ ] Queries use suitable pagination, eager loading and indexes where needed.
- [ ] Database constraints and transactions protect important invariants under concurrent requests.
- [ ] Migrations have a safe rollout and recovery plan for existing data.

## Jobs and operations
- [ ] Side effects have appropriate retry, idempotency and failure handling.
- [ ] Jobs that depend on new database records are dispatched at the right time.
- [ ] Logs contain useful context without secrets or sensitive personal data.

## Tests and handover
- [ ] Tests cover the expected behaviour, validation and authorisation, including tenant boundaries when relevant.
- [ ] Tests check the persistent state or other effects, not only response codes.
- [ ] CI checks pass, or known gaps and manual verification are documented.
- [ ] Review comments explain the risk, label severity and focus on the code.
