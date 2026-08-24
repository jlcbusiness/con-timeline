import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const isStaleAuthSessionError = (error: any) =>
  /User from sub claim in JWT does not exist|Auth session missing|Invalid Refresh Token|JWT expired/i.test(String(error?.message || ''));

export const useSupabaseSession = () => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getUser().then(async (response: any) => {
      if (!mounted) return;

      if (response.error) {
        if (isStaleAuthSessionError(response.error)) {
          await supabase.auth.signOut();
        }

        setUser(null);
        setIsLoading(false);
        return;
      }

      setUser(response.data?.user ?? null);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  return { user, isLoading, supabase };
};