# IssueFlow | Engineering Issue Tracker

A polished, responsive issue-tracking application for organizing software development work. Built with **HTML, CSS, and modern JavaScript**. No paid APIs, build tools, server, or framework are required to run the application.

![IssueFlow project dashboard](docs/preview-dashboard.png)

## Highlights

- Four-stage Kanban workflow: Backlog → In progress → In review → Done.
- Drag-and-drop issue movement and keyboard-accessible issue editing.
- Create, edit and delete issues with priority, assignee, due date, description and tags.
- Issue search, filters, activity history, and project health dashboard.
- Overdue and completion metrics calculated dynamically.
- Browser storage for persistent data, JSON backup/restore and CSV export.
- Dark/light themes, responsive layout, accessible form labels and dialogs.
- Automated unit tests for business logic and data validation.

See also the [Kanban board preview](docs/preview-board.png).

## Technology

| Layer | Technology |
|---|---|
| UI | Semantic HTML5, modern CSS3 |
| Logic | JavaScript ES modules |
| Persistence | Web Storage API (`localStorage`) |
| Testing | Built-in Node.js test runner |
| Deployment | GitHub Pages (static hosting) |

## Running locally

Open `index.html` in a modern browser **via a local static web server** (ES modules need an HTTP origin). For example, if Python is installed:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

Alternatively, use VS Code's Live Server extension.

## Tests

With Node.js 20+ installed:

```bash
npm test
```

No external Node dependencies are required.

## Deploy to GitHub Pages

1. Create a new public GitHub repository named `issueflow-engineering-tracker`.
2. Upload **the contents of this project directory** at the repository root, preserving the `assets/`, `tests/` and `docs/` folders.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select branch **main**, folder **/(root)** and click **Save**.
6. Open the Pages URL shown after deployment, typically `https://YOUR_USERNAME.github.io/issueflow-engineering-tracker/`.

No secrets, cloud databases, or paid accounts are necessary.

## Data architecture and limitations

IssueFlow is a **local-first web demo**. All project data is stored **in the current browser on the current device**, not in a cloud database. Other visitors receive their own demonstration workspace and **cannot access your issues**. Use Export backup / Import backup to move data between devices. Clearing site data or using private browsing may remove the data. This version intentionally does **not** claim multi-user sign-in, remote synchronization, or enterprise-grade collaboration.

A production expansion could add OAuth-based authentication, server-side APIs, PostgreSQL, row-level access controls and collaborative workspaces. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Project structure

```
index.html            Page structure and semantic forms
assets/styles.css     Responsive visual design
assets/app.js         UI state, interactions and persistence
assets/core.js        Pure validated issue/metrics/data logic
assets/favicon.svg    App icon
tests/core.test.mjs   Automated tests
docs/ARCHITECTURE.md Architecture and engineering trade-offs
docs/USER_GUIDE.md   Usage and deployment reference
```

## Development and provenance

This repository demonstrates a self-contained issue-tracking application. Its capabilities should be described according to the features that actually run. All sample tasks and names are fictional.
