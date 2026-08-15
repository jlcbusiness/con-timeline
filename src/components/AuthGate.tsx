import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    supabase.auth.getSession().then((r: any) => {
      if (mounted) setUser(r.data?.session?.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (mounted) setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!supabase) return alert('Supabase not configured');
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const signUpWithEmail = async () => {
    if (!supabase) return alert('Supabase not configured');
    const email = window.prompt('Email');
    const password = window.prompt('Password');
    if (!email || !password) return;
    await supabase.auth.signUp({ email, password });
    alert('Check your email for confirmation (if required).');
  };

  const signInWithEmail = async () => {
    if (!supabase) return alert('Supabase not configured');
    const email = window.prompt('Email');
    const password = window.prompt('Password');
    if (!email || !password) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const resetPassword = async () => {
    if (!supabase) return alert('Supabase not configured');
    const email = window.prompt('Email to send reset link to');
    if (!email) return;
    await supabase.auth.resetPasswordForEmail(email);
    alert('Password reset email sent if account exists');
  };

  const signOut = async () => {
    if (!supabase) return alert('Supabase not configured');
    await supabase.auth.signOut();
    setUser(null);
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
      {user ? (
        <div className="w-full">
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <div className="text-sm font-medium text-gray-900">Signed in as {user.email}</div>
              <div className="text-xs text-gray-500">Your timelines are stored in Supabase</div>
            </div>
            <button onClick={signOut} className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Sign out
            </button>
          </div>
          {children}
        </div>
      ) : (
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Sign in to Con-Timeline</h1>
          <p className="mt-2 text-sm text-gray-600">
            Create an account or sign in to load your timelines, events, and locations.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button onClick={signInWithGoogle} className="rounded bg-blue-600 px-3 py-2 text-white">Continue with Google</button>
            <button onClick={signUpWithEmail} className="rounded border border-gray-300 px-3 py-2 text-gray-800">Create account</button>
            <button onClick={signInWithEmail} className="rounded border border-gray-300 px-3 py-2 text-gray-800">Sign in</button>
            <button onClick={resetPassword} className="rounded border border-gray-300 px-3 py-2 text-gray-800">Reset password</button>
          </div>
        </div>
      )}
    </div>
  );
};
