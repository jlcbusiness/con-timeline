import React from 'react';
import { supabase } from '../lib/supabase';
import { useSupabaseSession } from '../hooks/useSupabaseSession';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useSupabaseSession();

  if (!supabase || isLoading) return null;

  return user ? <>{children}</> : null;
};
