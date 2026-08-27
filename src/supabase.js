import { createClient } from '@supabase/supabase-js';

/* Connexion au serveur partagé.

   Les deux valeurs viennent des variables d'environnement de Vercel. Si elles
   sont absentes, l'application fonctionne exactement comme avant : chaque
   téléphone garde ses commandes pour lui. Rien ne casse tant que le serveur
   n'est pas configuré. */

const URL = import.meta.env.VITE_SUPABASE_URL;
const CLE = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Le code d'accès sert de mot de passe à un compte unique et partagé :
// l'identifiant, lui, est fixe et n'a pas à être saisi.
export const COMPTE_PARTAGE = import.meta.env.VITE_SUPABASE_COMPTE || 'service@grill.local';

// Préfixée pour cohabiter sans risque avec un projet Supabase déjà utilisé
// par une autre application. Doit rester en phase avec supabase/schema.sql.
export const TABLE = 'grill_commandes';

export const partageActif = Boolean(URL && CLE);

export const supabase = partageActif
  ? createClient(URL, CLE, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;

/** Ouvre la session avec le code du restaurant. */
export async function connecter(code) {
  if (!supabase) return { ok: false, message: 'Le partage n’est pas configuré.' };
  const { error } = await supabase.auth.signInWithPassword({
    email: COMPTE_PARTAGE,
    password: code,
  });
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
