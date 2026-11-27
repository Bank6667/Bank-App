import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('YOUR_PROJECT'));
export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export async function simulatorAction<T = any>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('The app is not connected. Add the Supabase environment variables in Vercel.');
  const { data, error } = await supabase.functions.invoke('simulator-actions', { body });
  if (error) throw new Error(error.message || 'Simulator action failed');
  if (data?.error) throw new Error(data.error);
  return data as T;
}
