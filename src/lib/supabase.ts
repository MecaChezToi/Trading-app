import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || url === 'https://placeholder.supabase.co') {
      throw new Error('Supabase env vars not configured');
    }
    _client = createClient(url, key);
  }
  return _client;
}

export interface CompetitionPlayer {
  id: string;
  pseudo: string;
  balance: number;
  starting_balance: number;
  pnl_pct: number;
  trades_won: number;
  trades_lost: number;
  last_updated: string;
}
