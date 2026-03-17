import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function createEphemeralClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function callEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: 'Non authentifie' };

  const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    const text = await res.text().catch(() => '');
    return { data: null, error: `HTTP ${res.status}: ${text || res.statusText}` };
  }
  if (!res.ok) return { data: null, error: (json.error as string) || `HTTP ${res.status}` };
  return { data: json as T, error: null };
}
