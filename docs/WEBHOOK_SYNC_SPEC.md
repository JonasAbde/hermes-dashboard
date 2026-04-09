# Design Spec: GitHub Webhook Receiver & Workspace Sync Pipeline

## 1. Overview
The GitHub Webhook Receiver is a service endpoint within the Hermes Dashboard backend that listens for `push` events from GitHub. Its primary purpose is to trigger an automatic `git pull` in designated local directories to keep the Jonas's workspace in sync with the remote master/main branches.

## 2. Technical Architecture
- **Endpoint:** `POST /api/webhook/github`
- **Component:** Integrates into the existing `mission-control` (Next.js) or `hermes-dashboard` (Express) backend.
- **Trigger:** GitHub `push` event on the default branch (usually `master` or `main`).
- **Action:** Execute a shell-level `git pull` for the mapped directory.

## 3. Security & Authentication
To ensure only authorized GitHub events trigger synchronization:
- **Shared Secret:** A `GITHUB_WEBHOOK_SECRET` must be configured in the backend environment variables and the GitHub Repository Webhook settings.
- **Payload Validation:** The receiver must calculate the HMAC hex digest of the request body using the shared secret and compare it with the `X-Hub-Signature-256` header.
- **IP Filtering (Optional):** Restrict incoming requests to GitHub's published IP ranges for additional hardening.

## 4. Directory Mapping
The pipeline uses a mapping configuration to resolve which repository corresponds to which local path.

| Repository Name | Branch | Local Directory Path |
| :--- | :--- | :--- |
| `hermes-agent` | `main` | `/home/empir/hermes-agent` |
| `hermes-dashboard` | `master` | `/home/empir/hermes-dashboard-work` |
| `hermes-workspace` | `main` | `/home/empir/hermes-workspace` |

*Configuration Strategy:* Use a JSON mapping file at `~/.hermes/dashboard_state/sync-mapping.json` for easy updates.

## 5. Implementation Logic (Pseudocode)
```typescript
async function handleGitHubWebhook(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!verifySignature(req.body, signature, process.env.GITHUB_WEBHOOK_SECRET)) {
    return res.status(401).send('Unauthorized');
  }

  const { repository, ref } = req.body;
  const repoName = repository.name;
  const branch = ref.replace('refs/heads/', '');

  const map = loadSyncMapping();
  if (map[repoName] && map[repoName].branch === branch) {
    const path = map[repoName].path;
    await executeCommand(`cd ${path} && git pull origin ${branch}`);
    updateSyncStatus(repoName, 'Live');
  }
}
```

## 6. Frontend Integration: GitHubPage Overview
- **Status Indicator:** A "Sync Status" badge for each configured repository.
  - **Live:** Successfully pulled within the last 5 minutes.
  - **Idle:** No recent sync activity.
  - **Error:** Last sync attempt failed (e.g., merge conflict).
- **Manual Trigger:** A "Sync Now" button to manually invoke the pull logic if the webhook fails.

## 7. Error Handling
- **Merge Conflicts:** If `git pull` fails due to local changes, the status is set to `Error` and a notification is sent to the dashboard. No automatic `git reset --hard` is performed to prevent data loss.
- **Rate Limiting:** Protect the endpoint from spam using the existing `mutationLimiter`.
