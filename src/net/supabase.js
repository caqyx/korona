/** Klient Supabase, anonimowe logowanie i API pokoi/wyników. */
import { SUPABASE_URL, SUPABASE_KEY, hasSupabaseConfig } from './supabaseConfig.js';

export { hasSupabaseConfig };

let client = /** @type {import('@supabase/supabase-js').SupabaseClient|null} */ (null);
/** SDK Supabase ładowany dynamicznie — tylko gdy gracz wchodzi w tryb online. */
export async function getSupabase() {
  if (!hasSupabaseConfig()) return null;
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client ??= createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true }, realtime: { params: { eventsPerSecond: 40 } } });
  }
  return client;
}

/** Logowanie bez konta (anonymous sign-in) + profil z nickiem. Zwraca userId. @param {string} nick */
export async function signInAnon(nick) {
  const sb = await getSupabase();
  if (!sb) throw new Error('Brak konfiguracji Supabase');
  const { data: sess } = await sb.auth.getSession();
  let user = sess.session?.user ?? null;
  if (!user) {
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) throw new Error('Logowanie anonimowe nie powiodło się: ' + error.message);
    user = data.user;
  }
  if (!user) throw new Error('Brak użytkownika');
  await sb.from('profiles').upsert({ id: user.id, nickname: nick.slice(0, 16) }).then(() => {}, () => {});
  return user.id;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Kod pokoju: 5 znaków bez 0/O/1/I. @param {()=>number} [rand] */
export function generateRoomCode(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return s;
}
export const isValidRoomCode = (c) => /^[A-HJ-NP-Z2-9]{5}$/.test(c);

/**
 * API pokoi. Bez Supabase działa lokalnie (kod generowany, istnienie sprawdza presence).
 * @param {import('@supabase/supabase-js').SupabaseClient|null} sb
 */
export function createRoomsApi(sb) {
  return {
    async createRoom() {
      if (!sb) return { id: null, code: generateRoomCode(), ownerId: null };
      for (let i = 0; i < 5; i++) {
        const code = generateRoomCode();
        const { data, error } = await sb.from('rooms').insert({ code }).select('id, code, owner_id').single();
        if (!error && data) return { id: data.id, code: data.code, ownerId: data.owner_id };
        if (error && error.code !== '23505') throw new Error(error.message);
      }
      throw new Error('Nie udało się utworzyć pokoju');
    },
    /** @param {string} code */
    async findRoom(code) {
      if (!sb) return { id: null, code, ownerId: null, status: 'lobby' };
      const { data, error } = await sb.from('rooms').select('id, code, owner_id, status').eq('code', code).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id, code: data.code, ownerId: data.owner_id, status: data.status } : null;
    },
    /** @param {string|null} id @param {'lobby'|'playing'|'finished'} status */
    async setStatus(id, status) {
      if (!sb || !id) return;
      await sb.from('rooms').update({ status }).eq('id', id);
    },
    /**
     * Zapis wyników przez hosta (RLS: insert tylko gdy auth.uid() = matches.host_id).
     * @param {{roomId:string|null, hostId:string, startedAt:number, state:any}} m
     */
    async saveResults(m) {
      if (!sb) return { saved: false, reason: 'local' };
      const winner = m.state.players.find((p) => p.id === m.state.winnerId);
      const { data, error } = await sb
        .from('matches')
        .insert({ room_id: m.roomId, host_id: m.hostId, started_at: new Date(m.startedAt).toISOString(), ended_at: new Date().toISOString(), winner_id: winner ? winner.id : null })
        .select('id')
        .single();
      if (error || !data) return { saved: false, reason: error?.message ?? 'insert matches' };
      const rows = m.state.players.map((p) => ({
        match_id: data.id,
        user_id: p.id,
        score: Math.max(0, Math.round(p.score)),
        crown_seconds: Math.round(p.crownTime),
        last_hits: p.lastHits,
        boss_kills: p.bossKills,
        skin: p.skin,
        dnf: p.dnf,
      }));
      const { error: e2 } = await sb.from('match_results').insert(rows);
      return e2 ? { saved: false, reason: e2.message } : { saved: true, matchId: data.id };
    },
  };
}
