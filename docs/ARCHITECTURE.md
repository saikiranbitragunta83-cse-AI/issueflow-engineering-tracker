# IssueFlow architecture and trade-offs

## Application design

IssueFlow is a static single-page application split into three layers:

1. `index.html`: semantic structure, forms, navigation, and accessible controls.
2. `assets/app.js`: state handling, event listeners, DOM rendering, drag-and-drop, and browser persistence.
3. `assets/core.js`: pure functions for validation, filtering, metrics, CSV export, and backup validation.

This separation allows business rules to be unit-tested without a browser or a network connection.

## Data model

Each issue has `id`, `title`, `description`, `status`, `priority`, `assignee`, `due`, `tags`, `createdAt`, and `updatedAt` fields. Identifiers use the form `IF-001`; a numeric maximum is used to generate new IDs. This avoids reusing an ID while the highest-numbered issue is present. However, if the highest ID is deleted, a future ID may be reused; a server-generated UUID would eliminate reuse in a multi-user version.

Workflow state: `backlog`, `progress`, `review`, `done`.
Priority: `critical`, `high`, `medium`, `low`.

## Persistence

The application serializes task and activity arrays as JSON under the `issueflow.workspace.v1` key in `localStorage`. A schema version validates JSON backups and ensures the application rejects malformed or unexpectedly large imports. Browser storage has size limits and is neither multi-user nor guaranteed indefinitely persistent.

## Safety and validation

- User input is normalized with length restrictions and enumerated status/priority values.
- User-provided content is HTML-escaped before injection into UI templates.
- JSON import enforces a schema, record limits, and unique issue IDs.
- CSV export guards against basic spreadsheet formula injection by prefixing potentially dangerous cells.
- The app does not collect credentials, access external databases or send telemetry.

## Test strategy

`tests/core.test.mjs` covers required validation, overdue logic, filtering, metric aggregation, CSV export, and backup import. These tests run with `npm test` using Node's built-in test runner. Browser integration and cross-device testing remain useful next steps.

## Extension roadmap

Potential future work includes a secure backend, persistent multi-user accounts, collaborative permissions, server-side audit trails, issue comments, attachments, notifications, API-level unit tests, and CI workflows. None of those are claimed as implemented in this version.
