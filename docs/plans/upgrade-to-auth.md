# Plan: Upgrade to Auth + Remote Persistence


Goal: Replace localStorage persistence with a per-user backend and add authentication so events and locations sync across devices and users. Follow the patterns used by the `International-Packing-Checklist` repo: keep a snapshot-based export format, use Supabase Auth for user identity, and apply RLS policies for row isolation.

Recommendation: Supabase is the recommended option due to fast integration, snapshot-friendly workflows (Postgres JSON), and a documented example in the packing-checklist project. Alternatives: Firebase, AppWrite, or a custom API.

High-level tasks

1. Inspect `packing-checklist` implementation (requested):
   - I attempted to read `/home/joshlamont/Code/packing-checklist/.github/project-specific.instructions` but that file wasn't found from this environment. If you want me to adapt exact patterns from that repo, please either open that folder in this workspace or grant access.

2. Backend schema (suggested)
    - Table `users` (managed by Supabase Auth)
    - Table `events`:
       - `id` (text PK)
       - `user_id` (uuid references auth.users)
       - `title` (text)
       - `start_time` (timestamptz)
       - `end_time` (timestamptz)
       - `position` (int)
       - `metadata` (jsonb)
       - `created_at`, `updated_at` (timestamps)
    - Table `locations`:
       - `id`, `user_id`, `name`, `created_at`

    - Consider an `snapshots` table for exported/imported snapshots mirroring the `SavedPackingListSnapshot` pattern used by packing-checklist. This allows server-side restore and history.

3. App changes (implementation highlights)
   - Add `@supabase/supabase-js` and create `src/lib/supabase.ts` to instantiate the client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   - Implement `useAuth` wrapper and an `AuthGate` component to require sign-in for editing. Mirror `AuthGate` in packing-checklist for sign-in UX.
   - Replace `useEventPersistence` with `useEventStore` that:
     - Loads server data on sign-in (or falls back to local snapshot until user confirms migration).
     - Allows import/export snapshots compatible with `SavedPackingListSnapshot`.
     - Performs optimistic UI updates and retries on failure.
   - Add a migration flow on first login that offers to merge or replace server data with local `localStorage` state.

4. Security & roles
   - Use RLS to ensure users only access their rows (enable row-level security on events/locations and create policies for authenticated users).
   - Keep `service_role` secret out of client; only use `anon` key on client.

5. Migration
   - Provide a one-time import from localStorage to server when a user signs up (ask to confirm merge vs replace).

6. Deployment
   - Add env vars to Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
   - Update CORS and allowed origins in Supabase to include your Vercel domain.

Estimated work items

- Schema + RLS policies: 1-2 hours
- Integrate Supabase client + simple auth UI: 2-3 hours
- Replace persistence hooks + import flow: 3-5 hours
- Tests + QA: 2-4 hours

Notes and considerations

- If you expect collaborative editing or sharing events between users, extend schema to support shared lists and permissions.
- If you need server-side processing (large imports, transforms), consider adding serverless functions (Vercel Functions) behind authenticated endpoints.

Next steps I can take for you

- Open and inspect `/home/joshlamont/Code/packing-checklist` (if you add it to workspace) to port concrete code patterns.
- Scaffold `src/lib/supabase.ts` and a starter `useEventPersistence`-to-Supabase migration hook.
