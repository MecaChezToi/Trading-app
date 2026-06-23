import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
