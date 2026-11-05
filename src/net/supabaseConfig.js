/** Konfiguracja Supabase z .env — bez importu SDK (lekkie, dla menu startowego). */
export const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || '';
export const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
export const hasSupabaseConfig = () => !!SUPABASE_URL && !!SUPABASE_KEY && !SUPABASE_URL.includes('YOUR-PROJECT');
