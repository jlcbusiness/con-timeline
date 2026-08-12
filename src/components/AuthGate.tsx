import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then((r: any) => setUser(r.data?.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setUser(session?.user ?? null);
    });
    return () => { sub?.subscription.unsubscribe(); };
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

  if (!supabase) return <>{children}</>;

  return (
    <div>
      {user ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Signed in as {user.email}</span>
          <button onClick={signOut} className="px-2 py-1 bg-gray-100 rounded">Sign out</button>
          {children}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={signInWithGoogle} className="px-2 py-1 bg-blue-600 text-white rounded">Sign in with Google</button>
          <button onClick={signUpWithEmail} className="px-2 py-1 bg-gray-100 rounded">Sign up</button>
          <button onClick={signInWithEmail} className="px-2 py-1 bg-gray-100 rounded">Sign in</button>
          <button onClick={resetPassword} className="px-2 py-1 bg-gray-100 rounded">Reset password</button>
        </div>
      )}
    </div>
  );
};
