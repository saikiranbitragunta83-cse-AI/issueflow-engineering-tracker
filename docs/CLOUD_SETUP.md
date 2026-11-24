# IssueFlow Cloud: free-tier deployment and verification

This document is a deployment runbook for the optional collaboration backend. The guest demonstration works without any of these steps.

## Architecture

- **Frontend/PWA:** GitHub Pages (HTTPS, HTML/CSS/JavaScript, manifest, service worker)
- **Identity:** Supabase Auth with GitHub OAuth (no application password handling)
- **Cloud database:** Supabase PostgreSQL; workspace membership enforced by Row Level Security (RLS)
- **Team onboarding:** a private 32-character, randomly generated workspace invite code
- **Data updates:** client writes to PostgreSQL; browser polls for changes every 12 seconds while visible
- **Offline:** the static app shell and guest data work offline after first visit; cloud editing requires internet

Cloud workspaces and the guest demo are deliberately separate. Signing in starts with an empty cloud workspace; old guest issues aren't silently uploaded.

## 1. Create a Supabase project

1. Sign into https://supabase.com/dashboard (create a free account if necessary).
2. Choose **New project** and name it `issueflow-cloud`.
3. Select the **Free** plan and a region near your expected users.
4. Create a strong database password and store it privately. This password never goes into the app or GitHub.
5. Open the new project's dashboard.

## 2. Create and secure the database

1. From the Supabase sidebar, open **SQL Editor**.
2. Click **New query**.
3. Open the repository file [`supabase/schema.sql`](../supabase/schema.sql), copy **all** its SQL, and paste it into the query editor.
4. Click **Run**. Confirm there is no SQL error. Run it once on a fresh project.
5. In **Table Editor**, verify these four tables: `issueflow_workspaces`, `issueflow_members`, `issueflow_issues`, `issueflow_events`.
6. Confirm that **RLS is enabled on every table**. Do not disable RLS just to make debugging easier.

The schema creates two safe database functions: `issueflow_create_workspace` and `issueflow_join_workspace`. The workspace membership check is performed inside the database, not merely inside the website.

## 3. Enable GitHub login in Supabase

1. In Supabase open **Authentication → Sign In / Providers → GitHub**.
2. Copy the **callback URL** shown in the provider instructions. It is normally `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
3. Open GitHub in the account managing IssueFlow. Choose **Settings → Developer settings → OAuth Apps → New OAuth App**.
4. **Application name:** `IssueFlow`.
5. **Homepage URL:** `https://saikiranbitragunta83-cse-ai.github.io/issueflow-engineering-tracker/`.
6. **Authorization callback URL:** paste the **Supabase callback URL from step 2**, **not** the GitHub Pages URL.
7. Register the OAuth app. Copy its **Client ID** and generate a **Client secret**.
8. Back in **Supabase Authentication → Providers → GitHub**, enable the provider, paste Client ID + secret, and save.
9. Leave the GitHub Client secret **inside the Supabase dashboard only**. NEVER commit it to GitHub or send it in chat.

This login method avoids depending on Supabase's restricted default email sender. If the GitHub provider menus have moved, use the current Supabase dashboard's GitHub-provider setup instructions.

## 4. Configure the website redirect

In Supabase open **Authentication → URL Configuration**:

- **Site URL**: `https://saikiranbitragunta83-cse-ai.github.io/issueflow-engineering-tracker/`
- Add the **same full URL** to **Redirect URLs**.

The trailing slash matters; use the same URL that your working GitHub Pages site uses.

## 5. Connect the frontend (public configuration only)

1. In Supabase, find **Project Settings → API** or **Connect** (depending on the dashboard version).
2. Copy the **Project URL** beginning with `https://` and ending with `.supabase.co`.
3. Copy the **publishable (`sb_publishable_...`) key** or legacy `anon` **public** key.
4. Open [`assets/config.js`](../assets/config.js).
5. Fill in **only** these two values:

   ```js
   export const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
   export const SUPABASE_PUBLISHABLE_KEY = 'YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY';
   ```

6. Commit/push the changed config file to GitHub. GitHub Pages redeploys automatically.
7. Wait for the new deployment to finish in **Actions**, then refresh the public app.

**Safety:** Publishable/anon API keys are designed for browser use *with correct RLS*. `service_role`, `sb_secret_...`, GitHub OAuth Client secret, or a database password must **NEVER** be present in these files.

## 6. Verify that cloud collaboration works

1. Open the live IssueFlow website. The guest demo should still work without login.
2. Click **Cloud / Login**, then **Continue with GitHub**.
3. Authorize the GitHub OAuth app. The browser returns to the same IssueFlow URL.
4. The first login creates a private `My workspace`. Create a new issue and assign a due date.
5. Open the same URL on a second device/browser and sign into the **same GitHub account**. Open `My workspace`; the saved issue should appear.
6. On the first device, create a named workspace, e.g. `Sprint Alpha`, and **Copy** its private invite code.
7. On a *different GitHub account*, click **Cloud / Login**, then **Join a teammate's workspace**, paste the code, and select **Join**.
8. Create an issue on one device and move it to In progress on the other. Refresh the second page, or allow up to ~12 seconds while the tab is visible.
9. Confirm users who have **not** joined the workspace cannot read its records, including by attempting to query the backend with their own account.
10. Sign out and verify the guest demo still works and that its local sample data was not overwritten by the cloud workspace.

Avoid entering private information when demonstrating public portfolios.

## 7. Install the app for free

**Android Chrome:** Open the live URL → Chrome menu **⋮** → **Install app** or **Add to Home screen**.

**Windows Chrome/Edge:** Open the live URL → look for the **Install** icon near the address bar or use the browser menu's install option. IssueFlow also provides an **Install IssueFlow** button that opens the installation prompt when the browser supplies one.

**iPhone Safari:** Open the live URL → **Share** → **Add to Home Screen** (menu wording may vary).

A PWA launches like a standalone app and can have its own home-screen icon. It is **not automatically listed in the Play Store or App Store**.

## 8. Search discoverability (free, not guaranteed)

The public repo includes `robots.txt`, `sitemap.xml`, page description, Open Graph metadata, a canonical URL and structured data.

1. Open https://search.google.com/search-console/ and sign in with a Google account Sai Kiran controls.
2. Add the **URL prefix**: `https://saikiranbitragunta83-cse-ai.github.io/issueflow-engineering-tracker/`.
3. Select **HTML file verification**, download the verification HTML file, and upload it to the GitHub repository **root** (same folder as `index.html`).
4. Verify the property after GitHub Pages publishes the file.
5. Submit `https://saikiranbitragunta83-cse-ai.github.io/issueflow-engineering-tracker/sitemap.xml` in **Sitemaps**.
6. Use **URL Inspection → Request indexing** for the main site URL.
7. Link to IssueFlow from Sai Kiran's GitHub profile/README and LinkedIn portfolio.

Google may take days or weeks and indexing/ranking is never guaranteed. You can verify by searching `site:saikiranbitragunta83-cse-ai.github.io/issueflow-engineering-tracker/` after indexing.

## Limitations and free-tier conditions

- GitHub Pages static hosting is free for eligible public projects; the browser app is free to install.
- Supabase's Free projects have usage limits and can be paused after ~7 days of low activity; paused projects may need an owner to unpause them. The guest mode remains usable in the meantime.
- Supabase's default email provider only permits pre-authorized recipient addresses. GitHub OAuth avoids email confirmation for primary sign-in.
- Each app visitor may create their own private workspace after login; authorized members can collaborate with invite codes. The current version does not implement per-user roles within a workspace; members are trusted peers.
- Cloud changes are polled approximately every 12 seconds (not instant push); offline cloud edits are not queued.
- Guest data remains in the same browser's localStorage. Clear browser storage and guest changes can be lost. Export JSON first.
- Android Google Play publishing has a separate **US$25 one-time developer registration fee**. Apple App Store submission also requires its own developer account; an installable PWA requires neither store.
- Do not put private keys in the repo, and do not claim this is an audited enterprise system.
