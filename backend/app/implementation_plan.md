# EVE Account Deletion & Google Auth Remediation Plan

## Goal Description
Resolve the P0 critical hang in the account deletion flow and implement the required Google OAuth account management guardrails for the final beta release.

## Open Questions
None. The root cause of the indefinite hang has been isolated to O(N) synchronous network requests and SQLAlchemy ORM cascading, combined with stdout buffering.

## Proposed Changes

### 1. Fix Account Deletion Hang (Backend)
The backend currently performs synchronous GCS deletions in a loop and allows SQLAlchemy to individually delete child records in memory. We will fix this by moving the heavy cleanup to a background task and optimizing the database queries.

#### [MODIFY] `backend/app/services/account_service.py`
- Modify `delete_account` to push GCS file deletion (Avatars and Documents) to a background thread using `fastapi.BackgroundTasks` or standard threading.
- Add `sys.stdout.flush()` after critical log statements to ensure Cloud Run captures the logs immediately, even if the process hangs later.
- Refactor the workspace document deletion loop to run asynchronously or via GCS Batch operations, preventing the HTTP request from blocking.

#### [MODIFY] `backend/app/routes/account.py`
- Inject `BackgroundTasks` into the `delete_account` route.
- Pass the background tasks object to `AccountService.delete_account` so cleanup can happen asynchronously after returning a 200 OK to the frontend.

### 2. Google OAuth Guardrails (Frontend)
Google-managed accounts should not be able to edit their email or change their password, as this breaks the OAuth identity linkage.

#### [MODIFY] `frontend/src/app/dashboard/settings/page.tsx`
- Detect if the user is a Google Auth user by checking the provider in the session data (`session.user.app_metadata.provider === 'google'`).
- **Email Section**: If Google user, disable the email input. Display a "Managed by Google" badge and the required help text: *"This email is controlled by your Google account. Need to switch to another Google account? During beta, contact support and we can help migrate your login credentials."*
- **Password Section**: Hide the "Change Password" section entirely for Google users.

### 3. Database Cascade Optimization (Backend)
To prevent `db.delete(org)` from loading 100,000+ rows into Python memory:

#### [MODIFY] `backend/app/services/account_service.py`
- Instead of relying on `db.delete(org)` to trigger SQLAlchemy-level cascades for large tables, we will issue direct SQL `DELETE` operations for high-volume tables (e.g., `ProcessedDocument`, `ActivityLog`, `Task`) before deleting the Organization, or verify that Postgres `ON DELETE CASCADE` handles it efficiently without ORM hydration.

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
1. Log in with a Google account.
2. Verify the Settings page hides the password reset section and disables email editing with the correct help text.
3. Click "Delete Account".
4. Verify the frontend immediately receives a 200 OK and redirects to `/login`.
5. Verify Cloud Run logs show `[DELETE] Start` immediately.
6. Verify GCS and Supabase Admin deletion complete successfully in the background.
