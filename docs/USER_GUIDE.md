# IssueFlow user guide

## Start

Open the site and explore the sample issues. They are fictional test data and are loaded automatically when the site has no stored workspace. The local workspace is independent for each browser/device.

## Views

- **Overview**: summary metrics, completion rate, status distribution, priority breakdown, recently updated issues.
- **Kanban board**: draggable cards by workflow stage; click any card to edit. On touch devices, open a card and change its Status field.
- **All issues**: list search and filters for status/priority.
- **Activity log**: recent create/update/delete/status-move actions.

## Create and manage issues

Press **New issue**, fill in the title and optional fields, then save. Click any issue to edit or delete it. Press **N** while not typing to create an issue.

## Backup and export

Use **Export backup** to download `issueflow-backup.json`. Use **Import backup** to replace the current workspace with an earlier backup (you will see a confirmation). Use **Export CSV** for spreadsheet-compatible output.

## Browser storage disclaimer

The app stores data only in your local browser. Different devices and browsers do not share data automatically. If the browser's site data is cleared, the project data may be lost. Keep a JSON backup for anything you want to preserve.

## GitHub Pages deployment

Create a public repository and upload the entire project structure. In **Settings → Pages**, set Source to **Deploy from a branch**, branch to `main`, folder to `/(root)`, then Save. The app loads directly from the Pages URL. Do not change the folder layout or the relative `assets/` paths.
