# SchoolLedger GH

SchoolLedger is a mobile-first school fee app for Ghanaian schools. Each school signs in, keeps its own students and payments, and follows up with parents on WhatsApp. The app is an installable PWA and is structured so an Android Capacitor wrapper can load the deployed site later.

This repository replaces the original single-file `index.html` app. It does **not** connect to production and it does **not** change production data.

## What you can do

- Sign up and sign in with Supabase Auth, or use the on-device demo.
- Keep one school profile, with a term and academic year you choose.
- Add students and set a fee per class, with an optional fee override.
- Record a payment with method, note, date, and transaction ID. The amount paid and the balance are the sum of payment rows.
- See Paid, Partial, and Owing, and search or filter the roll.
- Mark daily feeding fees, including “mark all paid today”.
- Export payments, the message log, and the admin school list as CSV.
- Edit WhatsApp reminder and receipt templates.
- Open a personal `wa.me` chat, or email parents one at a time. An identical announcement uses BCC so parents do not see each other’s addresses.
- Send a personal SMS to every owing parent. Arkesel is the default provider; Hubtel and mNotify are adapters on the same server route. The provider key stays in server environment variables. A message is logged as **sent** only after that provider accepts it.
- Create a Paystack mobile-money link for a student's balance and include it in the reminder. The webhook checks the Paystack signature, verifies the charge, and records the payment once. Without keys, both SMS and Paystack stay stubs and no money moves.
- Platform admins list every school through a server route that uses the secret key. The public anon key cannot read another school’s rows.

## Stack

- Next.js 16 App Router and TypeScript
- Tailwind CSS
- Supabase Auth and Postgres, with row level security
- A service worker, web app manifest, and icons

## Setup

1. Install and check the app:

   ```bash
   npm install
   npm test
   npm run lint
   npm run typecheck
   npm run build
   npm run dev
   ```

2. Copy `.env.example` to `.env.local` and fill in a **new** Supabase project. Leave the variables empty if you only want demo mode.

3. Apply the migration in `supabase/migrations` to that new project (see below). Do not run it against the existing production database.

4. In Supabase Auth, decide whether new schools must confirm email. The register screen handles both cases. If confirmation is on, add `https://YOUR_DOMAIN/auth/callback` to the redirect allow list.

5. Deploy on Vercel with the same environment variables. `NEXT_PUBLIC_*` values are public. Everything else must stay on the server.

### Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser | New publishable key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted |
| `SUPABASE_SECRET_KEY` | Server only | New secret key. `SUPABASE_SERVICE_ROLE_KEY` is also accepted. Required for admin lists and for recording SMS as sent |
| `ADMIN_EMAILS` | Server only | Comma-separated platform admin emails |
| `SMS_PROVIDER` | Server only | `arkesel` (default), `hubtel`, or `mnotify` |
| `SMS_API_KEY` | Server only | Provider secret. Never put this in `NEXT_PUBLIC_` and never store it on a school |
| `SMS_CLIENT_ID` | Server only | Hubtel client id. Required only for Hubtel |
| `SMS_SENDER_ID` | Server only | Sender name, default `SchoolGH` (11 characters max) |
| `SMS_LIVE` | Server only | Must be `true` before any SMS is attempted. Otherwise the route is a stub and nothing is logged as sent |
| `PAYSTACK_SECRET_KEY` | Server only | `sk_test_...` for test mode. `sk_live_...` is ignored unless `PAYSTACK_LIVE=true` |
| `PAYSTACK_PUBLIC_KEY` | Server only | Optional `pk_test_...` key. Not used to create links, and it is not the secret |
| `PAYSTACK_LIVE` | Server only | Must be `true` before an `sk_live_` secret can charge or record |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | Browser | Support number, digits only |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Browser | Support inbox for tickets |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser, inlined at build | Public Sentry DSN for the EU project `schoolledgergh` |
| `SENTRY_DSN` | Server and edge | Same public DSN. The server reads this, then `NEXT_PUBLIC_SENTRY_DSN` |
| `SENTRY_ORG` | Build | `build-with-innocent` |
| `SENTRY_PROJECT` | Build | `schoolledgergh` |
| `SENTRY_AUTH_TOKEN` | Build only | Secret token for source map upload. Never commit it and never prefix it with `NEXT_PUBLIC_` |
| `SENTRY_URL` | Build | Optional. `https://de.sentry.io` when a personal token must target the EU host. Leave unset for an organization token |

To grant admin without putting an email in `ADMIN_EMAILS`, run this in the SQL editor of the **new** project as the database owner. Do not store the flag in user metadata; users can edit that.

```sql
update public.profiles
set is_platform_admin = true
where id = (select id from auth.users where email = 'you@school.edu.gh');
```

A normal school login cannot set `is_platform_admin` itself.

## Error tracking

Sentry is initialized for the browser, the Node server, and the edge runtime. Events go to the EU ingest host in the DSN. Names, phone numbers, emails, cookies, headers, request bodies, query strings, and local variables are not collected. Session replay is off.

Source maps upload during `next build` only when `SENTRY_AUTH_TOKEN` is set, using `SENTRY_ORG` and `SENTRY_PROJECT`. Without the token the build still succeeds and skips the upload. Client source maps are deleted after a successful upload.

## Database migration

The schema and policies live in:

`supabase/migrations/20261012164751_school_ledger_schema.sql`

`supabase/migrations/20261012201035_paystack_payment_links.sql`

The first file creates `profiles`, `schools`, `students`, `payments`, `feeding_marks`, and `message_log`. The second adds `payment_links` for Paystack checkouts. Apply both, in that order. Both enable and force row level security. Authenticated users can touch only the school tied to their login. `anon` has no table grants and no policies. `student_fee_status` is a `security_invoker` view: paid amount and balance are `term_fee` minus the sum of payments. There is no `paid` column to overwrite, and there is no SMS or Paystack key column.

Apply it to a new project in either of these ways:

- Supabase Dashboard → SQL Editor → paste the migration → Run.
- Or, after `supabase link --project-ref YOUR_NEW_PROJECT_REF`, run `supabase db push`.

Linking and pushing are manual steps. This repo does not run them.

If the old production tables already exist, `CREATE TABLE` fails immediately. The migration has no `DROP` and no `DELETE`, but it is still the wrong script for the live database. Moving the old rows across needs a separate, reviewed data migration. That work is not done here.

The SQL is checked locally with PGlite (`npm test`). That test creates two schools and asserts that one cannot read the other, that anon cannot read schools, that a balance comes from payments, that a browser role cannot insert `status = 'sent'`, and that a browser role cannot mark a Paystack link paid.

### SMS reminders

`POST /api/sms/send` with `{ "audience": "owing", "message": "Dear {parent_name}, {student_name} owes GH₵{balance}. Pay: {payment_link}" }` texts each owing parent a different balance. `{payment_link}` is that student's Paystack checkout when test keys are set, and the words `MoMo link unavailable` when they are not. Delivery is `sent` or `failed` on `message_log`. A missing key or `SMS_LIVE` other than `true` does not call the provider and does not write `sent`.

Set the Paystack webhook to `https://YOUR_DOMAIN/api/paystack/webhook`. The route reads the raw body, checks `x-paystack-signature` (HMAC SHA512 with `PAYSTACK_SECRET_KEY`), then calls Paystack verify. The same reference records one payment. A second delivery of that event does not add another row.

## PWA and Android later

The app ships `public/manifest.webmanifest`, icons, and `public/sw.js`. The service worker caches the shell and falls back to `offline.html` when a navigation fails. Live edits are refused while offline and the error stays on screen. A previously loaded school can still be shown from device storage, labelled as an offline copy.

Chrome can install the app when it is served over HTTPS (or localhost), the manifest has 192 and 512 icons, `display` is `standalone`, and the service worker handles `fetch`. Use **Install app** on the sign-in screen when the browser offers it, or the browser’s own install menu.

`capacitor.config.example.ts` shows a later Android wrapper. Point `server.url` at the deployed Next.js site so the admin and SMS routes keep working. A static export would not serve those routes.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local app |
| `npm test` | Domain rules, SMS logging, and RLS |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run build` | Production build |

## Still to do

- Scheduled fee reminders. Owing parents can be texted now, but nothing sends on a clock.
- PDF or printable receipts. The receipt is an on-screen preview plus WhatsApp.
- A real mailbox for bulk email. Parents are contacted through the device mail app, with BCC or one message each.
- Handset delivery reports from the SMS provider. `sent` means the provider accepted the message.
- The Capacitor Android project.
- A data migration from the original production tables, if those rows should move.
- Staff roles inside one school, and stored support tickets.
