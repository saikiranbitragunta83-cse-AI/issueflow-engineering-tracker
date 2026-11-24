# IssueFlow user guide

## Quick start: no account needed

Open the live application, choose **Overview**, **Kanban board**, or **All issues**. Sample issues are provided. Select **New issue** to add a title, priority, status, due date, assignee and tags. Drag a card between columns or edit its Status field to advance it. Use search and filters, export CSV, or save a JSON backup.

Guest demo changes are saved in the current browser. Opening the site elsewhere will show a separate guest workspace.

## Cloud team workspace (when enabled by the site owner)

Choose **Cloud / Login**, then **Continue with GitHub**. Your first login creates a private personal workspace. In the account dialog you can create another team workspace, switch between your workspaces, or join one using an invite code from a member. Anyone with the code and a signed-in account can join, so treat the code as private.

Cloud issue changes appear on other signed-in devices after refreshing or within approximately 12 seconds while the page is visible. If there is no connection or the backend is paused, cloud edits are unavailable. Guest mode continues to function independently.

## Install as an app

Use the **Install IssueFlow** sidebar button if your browser offers an install prompt, or use the browser's **Install app** or **Add to Home Screen** menu. This is a Progressive Web App, so no app-store account or fee is necessary.

## Backups and privacy

- Guest issues live in localStorage; backups are recommended.
- Cloud issues live in a hosted PostgreSQL database with membership-based access policies.
- JSON backup exports work from either mode. **Import is restricted to guest mode** to avoid accidentally overwriting a team workspace.
- Do not put sensitive personal or business data into a demonstration system.
