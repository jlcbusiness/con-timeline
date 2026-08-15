# How to create a Vercel app and connect it to GitHub

This guide assumes you already have a Vercel account and a GitHub repository for this project. It outlines the minimal steps to deploy the app and configure environment variables for Supabase (or another backend).

1. Push the repo to GitHub
   - If not already done:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     gh repo create <repo-name> --public --source=. --remote=origin --push
     ```

2. Import project into Vercel
   - Log in to Vercel and choose "New Project" → Import Git Repository → select your GitHub repo.
   - Framework preset: Vite (or auto-detected).
   - Build command: `npm run build`
   - Output directory: `dist`

3. Add environment variables (if using Supabase)
    - In the Vercel project settings, add the Vite-exposed public variables:
       - `VITE_TIMELINE_SUPABASE_URL` = your Supabase project URL
       - `VITE_TIMELINE_SUPABASE_ANON_KEY` = anon public key
    - Optional aliases like `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are also supported.
    - Do NOT add the `service_role` key to client envs; keep that secret for server-side use only.

4. Database setup with Supabase (quick)
   - Create a Supabase project and database.
   - Create `events`, `locations`, and `timelines` tables and RLS policies. You can run the provided SQL at [supabase/schema-events-locations.sql](supabase/schema-events-locations.sql) to create the schema and policies.
   - Enable Row Level Security and add policies so authenticated users can insert/select/update/delete their own rows.

5. Link auth
   - Use Supabase Auth in the client for sign-in and use the `user.id` to filter queries.
   - Provide a migration step to push local `localStorage` data to the user's account on first login (ask the user merge vs replace).

6. Deploy and verify
   - Trigger a Vercel deployment (push to main). Verify build logs and visit the generated URL.
   - Test sign-in and persistence flows.

Troubleshooting

- Build fails: check `vite` and `typescript` output in Vercel logs; ensure Node version compatibility.
- Env vars not found: redeploy after adding env vars in Vercel settings to ensure they take effect.
