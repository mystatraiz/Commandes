import { createClient } from '@supabase/supabase-js';

/* Connexion à Supabase.

   Les deux valeurs viennent des variables d'environnement (Vercel ou
   .env.local). Absentes, l'application fonctionne en local sur le téléphone :
   tout est conservé dans IndexedDB, rien n'est envoyé nulle part. */

const URL = import.meta.env.VITE_SUPABASE_URL;
const CLE = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Le code d'accès sert de mot de passe à un compte unique : l'identifiant
// est fixe et n'a pas à être saisi sur le téléphone.
export const COMPTE = import.meta.env.VITE_SUPABASE_COMPTE || 'moi@forge.local';

// Préfixée pour cohabiter avec les autres applications du même projet
// Supabase (le grill, par exemple). Doit rester en phase avec supabase/schema.sql.
export const TABLE = 'forge_entrees';

export const syncActive = Boolean(URL && CLE);

export const supabase = syncActive
  ? createClient(URL, CLE, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;

export async function connecter(code) {
  if (!supabase) return { ok: false, message: 'La synchronisation n’est pas configurée.' };
  const { error } = await supabase.auth.signInWithPassword({ email: COMPTE, password: code });
  if (!error) return { ok: true };
  const invalide = /invalid login credentials/i.test(error.message);
  return {
    ok: false,
    message: invalide ? 'Code incorrect.' : `Connexion impossible : ${error.message}`,
  };
}

export async function deconnecter() {
  if (supabase) await supabase.auth.signOut();
}

export async function sessionCourante() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}
