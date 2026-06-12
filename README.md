# Trust Authenticator

A privacy-first verified-identity platform. Users upload sensitive documents
into a categorized vault; third parties (banks, employers, landlords) see a
single public **Trust Link** (`/u/username`) showing only *verification
status* — never the documents themselves.

**Stack:** Next.js 15 (App Router, TypeScript) · Tailwind CSS v4 ·
Supabase (Postgres + Auth + Storage) · Vercel — all free tier.

---

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates:
   - `profiles` and `documents` tables with **Row Level Security**
   - the `get_trust_status` RPC (the only thing the public page can read)
   - a private `documents` bucket and a public `avatars` bucket with
     per-user-folder storage policies
3. Run [`supabase/automation.sql`](supabase/automation.sql) the same way.
   This enables `pg_cron` and schedules a job that automatically verifies
   pending documents about a minute after upload (rejecting any that fail
   file-type/path integrity checks). The admin panel remains as a manual
   override; pause automation anytime with
   `select cron.unschedule('auto-verify-documents');`
3. In **Authentication → URL Configuration**, set the Site URL to
   `http://localhost:3000` (add your Vercel URL after deploying) and add
   `http://localhost:3000/auth/callback` to the redirect list.

## 2. Run locally

```bash
npm install
copy .env.local.example .env.local   # then fill in your project URL + anon key
npm run dev
```

Keys live in Supabase Dashboard → **Project Settings → API**.

## 3. First user & admin

1. Visit `http://localhost:3000/login`, sign in via magic link, complete
   onboarding (this creates your `profiles` row).
2. To review documents, make yourself admin in the SQL Editor:

   ```sql
   update public.profiles set is_admin = true where username = 'your_username';
   ```

3. An **Admin** button appears on the dashboard → verification queue with
   Verify / Reject / Reset toggles (the simulated verification logic).

## 4. Deploy to Vercel

1. Push this folder to a GitHub repo and import it in Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as
   environment variables.
3. Update Supabase Auth URL configuration with your
   `https://your-app.vercel.app` domain (Site URL + `/auth/callback` redirect).

## Security model

| Layer | Rule |
|---|---|
| `documents` table | RLS: owner-only read/insert/delete; admins may read + update status. **No anonymous access.** |
| `documents` bucket | Private. Files live under `<user_id>/…`; storage policies match folder to `auth.uid()`. Owners open files via 60-second signed URLs. |
| Trust Link page | Reads only the `get_trust_status(username)` RPC — a `security definer` aggregate returning per-category counts, never file paths or contents. |
| `profiles` table | Publicly readable by design (name, bio, avatar). Never store sensitive data here. |

## Folder structure

```
trust-authenticator/
├── supabase/
│   └── schema.sql                  # full DB schema + RLS + storage policies
├── src/
│   ├── middleware.ts               # session refresh + route protection
│   ├── lib/
│   │   ├── types.ts                # shared types + category config
│   │   └── supabase/
│   │       ├── client.ts           # browser client
│   │       └── server.ts           # server client (cookies)
│   ├── components/
│   │   ├── UploadComponent.tsx     # storage upload + metadata insert
│   │   ├── DocumentList.tsx        # signed-URL view / delete
│   │   ├── TrustScoreBar.tsx       # % verified progress bar
│   │   ├── StatusBadge.tsx
│   │   ├── CopyLinkButton.tsx
│   │   └── AdminReviewRow.tsx      # verify / reject / reset toggle
│   └── app/
│       ├── layout.tsx  page.tsx  globals.css
│       ├── login/page.tsx          # magic-link sign in
│       ├── auth/callback/route.ts  # code → session exchange
│       ├── onboarding/page.tsx     # username, bio, avatar
│       ├── dashboard/page.tsx      # categorized document vault
│       ├── admin/page.tsx          # verification queue
│       └── u/[username]/page.tsx   # THE TRUST LINK (public)
└── .env.local.example
```
