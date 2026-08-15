import { createClient } from '@supabase/supabase-js';

// Vite only exposes env vars prefixed with `VITE_` to client-side code.
const url = (import.meta.env as any).VITE_TIMELINE_SUPABASE_URL
	|| (import.meta.env as any).VITE_SUPABASE_URL;

const anon = (import.meta.env as any).VITE_TIMELINE_SUPABASE_ANON_KEY
	|| (import.meta.env as any).VITE_SUPABASE_ANON_KEY;

export const supabase = url && anon ? createClient(url, anon) : null as any;
