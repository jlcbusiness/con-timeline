import { createClient } from '@supabase/supabase-js';

// Support multiple env var naming conventions. The preferred names use the
// `TIMELINE_SUPABASE_` prefix to avoid collisions with other projects.
// For Vite client exposure you may also set `VITE_TIMELINE_SUPABASE_*`.
const url = (import.meta.env as any).TIMELINE_SUPABASE_URL
	|| (import.meta.env as any).VITE_TIMELINE_SUPABASE_URL
	|| (import.meta.env as any).VITE_SUPABASE_URL;

const anon = (import.meta.env as any).TIMELINE_SUPABASE_ANON_KEY
	|| (import.meta.env as any).VITE_TIMELINE_SUPABASE_ANON_KEY
	|| (import.meta.env as any).VITE_SUPABASE_ANON_KEY;

export const supabase = url && anon ? createClient(url, anon) : null as any;
