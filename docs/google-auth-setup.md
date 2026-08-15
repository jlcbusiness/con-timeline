# Google Auth Setup for Con-Timeline

This project uses Supabase Auth for sign-in, with Google as an OAuth provider.

## What you need

- A Supabase project
- A Google Cloud project
- The Supabase public client env vars set in Vercel:
  - `VITE_TIMELINE_SUPABASE_URL`
  - `VITE_TIMELINE_SUPABASE_ANON_KEY`

## 1. Enable Google in Supabase

1. Open your Supabase project.
2. Go to `Authentication` -> `Providers` -> `Google`.
3. Turn Google provider on.

## 2. Create the Google OAuth client

1. Open Google Cloud Console.
2. Make sure you have a project selected.
3. Configure the OAuth consent screen if needed.
4. Create an OAuth Client ID.
5. Choose `Web application` as the application type.

## 3. Add Authorized JavaScript origins

Add these origins to the Google OAuth client:

- `http://localhost:5173`
- `https://con-timeline.vercel.app`

If you use a different local dev port, add that too.

## 4. Add the Authorized redirect URI

Use the Supabase OAuth callback URL for your project:

- `https://<your-project-ref>.supabase.co/auth/v1/callback`

Replace `<your-project-ref>` with your actual Supabase project ref.

## 5. Copy the Google credentials into Supabase

1. Return to Supabase.
2. Paste the Google Client ID and Google Client Secret from Google Cloud into the Google provider settings.

## 6. Configure Supabase redirect URLs

In Supabase, go to `Authentication` -> `URL Configuration` and set:

- `Site URL`: `https://con-timeline.vercel.app`
- `Additional Redirect URLs`:
  - `http://localhost:5173`
  - `https://con-timeline.vercel.app`

## 7. Set the Vercel env vars

1. Add `VITE_TIMELINE_SUPABASE_URL`.
2. Add `VITE_TIMELINE_SUPABASE_ANON_KEY`.
3. Redeploy after setting them.

## 8. Deploy the app

1. Redeploy the site if you haven’t already.
2. Test both Google sign-in and email/password sign-in.

## Notes

- The app does not support anonymous local rendering.
- If Supabase is not configured, the app should show an auth-only blocking state.
- Google sign-in will only work if the origins and redirect URI match exactly across Google Cloud and Supabase.
