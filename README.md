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
- Send SMS only from the server. The provider key is never stored on the school or in the browser. A message is logged as **sent** only after Hubtel or Arkesel accepts it.
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
| `SMS_PROVIDER` | Server only | `hubtel` or `arkesel` |
| `SMS_API_KEY` | Server only | Provider secret. Never put this in `NEXT_PUBLIC_` |
| `SMS_CLIENT_ID` | Server only | Hubtel client id |
| `SMS_SENDER_ID` | Server only | Sender name, default `SchoolGH` |
| `SMS_LIVE` | Server only | Must be `true` before any SMS is attempted |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | Browser | Support number, digits only |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Browser | Support inbox for tickets |

To grant admin without putting an email in `ADMIN_EMAILS`, run this in the SQL editor of the **new** project as the database owner. Do not store the flag in user metadata; users can edit that.

```sql
update public.profiles
set is_platform_admin = true
where id = (select id from auth.users where email = 'you@school.edu.gh');
```

A normal school login cannot set `is_platform_admin` itself.

## Database migration

The schema and policies live in:

`supabase/migrations/20261012164751_school_ledger_schema.sql`

The file creates `profiles`, `schools`, `students`, `payments`, `feeding_marks`, and `message_log`. It enables and forces row level security. Authenticated users can touch only the school tied to their login. `anon` has no table grants and no policies. `student_fee_status` is a `security_invoker` view: paid amount and balance are `term_fee` minus the sum of payments. There is no `paid` column to overwrite, and there is no SMS key column.

Apply it to a new project in either of these ways:

- Supabase Dashboard → SQL Editor → paste the migration → Run.
- Or, after `supabase link --project-ref YOUR_NEW_PROJECT_REF`, run `supabase db push`.

Linking and pushing are manual steps. This repo does not run them.

If the old production tables already exist, `CREATE TABLE` fails immediately. The migration has no `DROP` and no `DELETE`, but it is still the wrong script for the live database. Moving the old rows across needs a separate, reviewed data migration. That work is not done here.

The SQL is checked locally with PGlite (`npm test`). That test creates two schools and asserts that one cannot read the other, that anon cannot read schools, that a balance comes from payments, and that a browser role cannot insert `status = 'sent'`.

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

- Scheduled fee reminders.
- MoMo and Paystack collection. Payments can store a transaction id, but money is not collected in the app.
- PDF or printable receipts. The receipt is an on-screen preview plus WhatsApp.
- A real mailbox for bulk email. Parents are contacted through the device mail app, with BCC or one message each.
- Turning on live SMS with Hubtel or Arkesel credentials (`SMS_LIVE=true`).
- The Capacitor Android project.
- A data migration from the original production tables, if those rows should move.
- Staff roles inside one school, and stored support tickets.
