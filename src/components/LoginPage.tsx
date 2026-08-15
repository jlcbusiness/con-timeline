import React from 'react';
import { supabase } from '../lib/supabase';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const signInWithGoogle = async () => {
    if (!supabase) return alert('Supabase not configured');
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const signUpWithEmail = async () => {
    if (!supabase) return alert('Supabase not configured');
    if (!email || !password) {
      setStatusMessage('Enter an email and password first.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setIsSubmitting(false);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setStatusMessage('Check your email for confirmation, if required.');
  };

  const signInWithEmail = async () => {
    if (!supabase) return alert('Supabase not configured');
    if (!email || !password) {
      setStatusMessage('Enter an email and password first.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (error) {
      setStatusMessage(error.message);
    }
  };

  const resetPassword = async () => {
    if (!supabase) return alert('Supabase not configured');
    if (!email) {
      setStatusMessage('Enter your email first.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setIsSubmitting(false);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setStatusMessage('Password reset email sent if the account exists.');
  };

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Supabase not configured</h1>
          <p className="mt-2 text-sm text-gray-600">
            This app requires a Supabase login before it can load any timeline data.
            Set the Vite public env vars and redeploy, then sign in again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Sign in to Con-Timeline</h1>
        <p className="mt-2 text-sm text-gray-600">
          Create an account or sign in to load your timelines, events, and locations.
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={event => {
            event.preventDefault();
            void signInWithEmail();
          }}
        >
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Email
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Password
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                autoComplete="current-password"
                placeholder="Your password"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <button type="button" onClick={signInWithGoogle} className="rounded bg-blue-600 px-3 py-2 text-white" disabled={isSubmitting}>Continue with Google</button>
            <button type="button" onClick={signUpWithEmail} className="rounded border border-gray-300 px-3 py-2 text-gray-800 disabled:opacity-50" disabled={isSubmitting}>Create account</button>
            <button type="submit" className="rounded border border-gray-300 px-3 py-2 text-gray-800 disabled:opacity-50" disabled={isSubmitting}>Sign in</button>
            <button type="button" onClick={resetPassword} className="rounded border border-gray-300 px-3 py-2 text-gray-800 disabled:opacity-50" disabled={isSubmitting}>Reset password</button>
          </div>

          {statusMessage && <p className="text-sm text-gray-600">{statusMessage}</p>}
        </form>
      </div>
    </div>
  );
};