# Auth email templates

Paste these into Supabase: **Authentication → Emails → Templates** (one tab per email). Use the subject in the table, and paste the whole HTML file into the message body.

| Template tab | Subject | File |
| --- | --- | --- |
| Confirm sign up | Confirm your Build Up email | `confirm-signup.html` |
| Reset password | Reset your Build Up password | `reset-password.html` |
| Magic link | Your Build Up sign-in link | `magic-link.html` |
| Change email address | Confirm your new Build Up email | `change-email.html` |
| Invite user | You're invited to Build Up | `invite.html` |

The links point to the app (`{{ .SiteURL }}?token_hash=…&type=…`), not to supabase.co. The app verifies the token itself (`verifyEmailLink` in `src/state/session.ts`). A link whose domain matches the sender's domain is less likely to be marked as junk.

Deploy the app version that contains `verifyEmailLink` **before** switching the templates, or the new links won't sign anyone in.
