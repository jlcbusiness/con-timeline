import React from 'react';
import { supabase } from '../lib/supabase';
import { useSupabaseSession } from '../hooks/useSupabaseSession';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useSupabaseSession();

  const signOut = async () => {
    if (!supabase) return alert('Supabase not configured');
    await supabase.auth.signOut();
  };

  if (!supabase || isLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {user ? (
        <div className="mx-auto w-full max-w-[1600px]">
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
      ) : null}
    </div>
  );
};
