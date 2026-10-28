# Supabase QA cleanup — 28 October 2026

Removed the three dedicated EasyEarn QA accounts and their related test data from the shared Supabase project in a single database transaction.

| Entity | Deleted rows |
| --- | ---: |
| Auth accounts | 3 |
| User profiles | 3 |
| Job listings | 3 |
| Applications | 3 |
| Payments | 3 |
| Ratings | 6 |
| Reports | 2 |
| Work history | 3 |
| Notifications, including chat messages | 157 |

No matching saved jobs or chatbot logs were present. Supabase Storage contained no objects at inspection time.

The cleanup selected the exact dedicated QA email addresses, then removed records linked by account, job and application IDs. Post-cleanup queries confirmed zero remaining QA Auth accounts, profiles, QA-labelled listings and notifications referencing those accounts.

Earlier QA results are historical evidence. The accounts and persisted workflow records used for those tests are no longer available. Database changes are already applied; this document records the operation and does not rerun it.
