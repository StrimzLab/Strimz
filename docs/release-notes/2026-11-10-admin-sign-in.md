---
date: 2026-11-10
feature: Admins sign in at /admin/login without becoming merchants
scope: fix
scenario-impact: none
---

# Admin sign-in

Opening `/admin` while signed out used to go through the merchant login. That created an
empty "Unnamed merchant" for every admin and sent anyone who hadn't onboarded as a
merchant to `/onboarding` instead of the dashboard.

Admins now sign in at `/admin/login`. It signs in with Privy and goes straight back to
the admin page they asked for. It never calls `/v1/auth/sync`, so no merchant is
created. Access is still decided by the api: only an active admin (the super_admin
from `admin:bootstrap`, or someone who accepted an invite) gets in. Any other account
sees "Not authorized".

- If the admin check fails for another reason, such as the api being down, the page
  says so and offers a retry instead of calling it a refusal.
- Idle admins are signed out to `/admin/login`.
- The not-authorized screen has the light/dark toggle.

Merchant rows already created for admins are not removed by this change.
