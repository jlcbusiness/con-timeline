import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface Fandom {
  id: string;
  name: string;
  createdAt: Date;
}

interface FandomRow {
  id: string;
  name: string;
  created_at: string;
}

const getNameKey = (name: string) => name.trim().toLocaleLowerCase();
const createUuid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

const isMissingTableError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; message?: string };
  return value.code === 'PGRST205' || value.code === '42P01' || /could not find the table/i.test(value.message ?? '');
};

export const useFandomPersistence = (activeTimelineId?: string | null) => {
  const [fandoms, setFandoms] = useState<Fandom[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!supabase || !activeTimelineId) {
        setFandoms([]);
        return;
      }

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) return;

        const { data, error } = await supabase
          .from('fandoms')
          .select('*')
          .eq('user_id', userData.user.id)
          .eq('timeline_id', activeTimelineId)
          .order('created_at', { ascending: true });
        if (error) throw error;

        if (!cancelled) {
          setFandoms((data ?? []).map((item: FandomRow) => ({ id: item.id, name: item.name, createdAt: new Date(item.created_at) })));
        }
      } catch (error) {
        if (!isMissingTableError(error)) console.error('Failed to load fandoms', error);
        if (!cancelled) setFandoms([]);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [activeTimelineId]);

  const addFandom = (name: string): Fandom => {
    const normalizedName = name.trim();
    const existing = fandoms.find(item => getNameKey(item.name) === getNameKey(normalizedName));
    if (existing) return existing;

    const fandom = { id: createUuid(), name: normalizedName, createdAt: new Date() };
    setFandoms(current => [...current, fandom]);

    if (supabase && activeTimelineId) {
      void supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
        if (!data.user) return;
        const timestamp = fandom.createdAt.toISOString();
        const { error } = await supabase.from('fandoms').insert({
          id: fandom.id,
          timeline_id: activeTimelineId,
          user_id: data.user.id,
          name: fandom.name,
          created_at: timestamp,
          updated_at: timestamp
        });
        if (error && !isMissingTableError(error)) console.error('Failed to add fandom', error);
      });
    }

    return fandom;
  };

  return { fandoms, addFandom };
};