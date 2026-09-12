import { createClient } from '@supabase/supabase-js';

/* Connexion à Supabase.

   Les deux valeurs viennent des variables d'environnement (Vercel ou
   .env.local). Absentes, l'application fonctionne en local sur le téléphone :
   tout est conservé dans IndexedDB, rien n'est envoyé nulle part — et les
   défis, qui supposent d'autres joueurs, s'annoncent indisponibles. */

const URL = import.meta.env.VITE_SUPABASE_URL;
const CLE = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Doivent rester en phase avec supabase/schema.sql.
export const TABLE = 'gs_entrees';
export const TABLE_DEFIS = 'gs_defis';
export const TABLE_PARTICIPATIONS = 'gs_participations';
export const TABLE_PROFILS = 'gs_profils';

export const syncActive = Boolean(URL && CLE);

export const supabase = syncActive
  ? createClient(URL, CLE, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;

/* ---------------- Messages ----------------
   Ceux de Supabase arrivent en anglais et parlent de « credentials » : on les
   traduit, sinon l'écran de connexion devient inutilisable pour qui ne parle
   pas la langue du serveur. */

function traduire(message = '') {
  if (/invalid login credentials/i.test(message)) return 'Adresse ou mot de passe incorrect.';
  if (/user already registered|already been registered/i.test(message)) return 'Un compte existe déjà avec cette adresse.';
  if (/password should be at least/i.test(message)) return 'Mot de passe trop court : six caractères au minimum.';
  if (/unable to validate email|invalid format/i.test(message)) return 'Cette adresse ne ressemble pas à une adresse e-mail.';
  if (/email not confirmed/i.test(message)) return 'Adresse pas encore confirmée : regarde ta boîte mail.';
  if (/rate limit|too many requests/i.test(message)) return 'Trop d’essais d’affilée. Reprends dans une minute.';
  if (/fetch|network/i.test(message)) return 'Serveur injoignable. Vérifie ta connexion.';
  return message;
}

const pasConfigure = { ok: false, message: 'Les comptes ne sont pas configurés sur cette installation.' };

/* ---------------- Compte ---------------- */

export async function inscrire({ email, mdp, pseudo, emoji = '💪' }) {
  if (!supabase) return pasConfigure;
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: mdp });
  if (error) return { ok: false, message: traduire(error.message) };

  // Sans confirmation d'adresse, la session est ouverte tout de suite et on
  // peut poser le profil. Avec confirmation, il attendra la première connexion.
  if (data.session) await ecrireProfil({ pseudo, emoji });
  return { ok: true, session: data.session, confirmationRequise: !data.session };
}

export async function connecter({ email, mdp }) {
  if (!supabase) return pasConfigure;
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: mdp });
  if (error) return { ok: false, message: traduire(error.message) };
  return { ok: true };
}

export async function deconnecter() {
  if (supabase) await supabase.auth.signOut();
}

export async function sessionCourante() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function utilisateurCourant() {
  const session = await sessionCourante();
  return session?.user || null;
}

/* ---------------- Profil ----------------
   Le pseudo est recopié dans chaque participation : afficher un classement
   n'oblige donc jamais à lire la fiche des autres. */

export async function lireProfil() {
  if (!supabase) return null;
  const user = await utilisateurCourant();
  if (!user) return null;
  const { data, error } = await supabase.from(TABLE_PROFILS).select('*').eq('id', user.id).maybeSingle();
  if (error) return null;
  if (data) return data;
  // Compte créé avec confirmation d'adresse : le profil n'a pas encore pu être
  // écrit. On le pose à partir de l'adresse, l'écran Profil permettra d'en
  // changer.
  const pseudo = (user.email || 'Joueur').split('@')[0].slice(0, 24);
  return ecrireProfil({ pseudo });
}

export async function ecrireProfil({ pseudo, emoji = '💪' }) {
  if (!supabase) return null;
  const user = await utilisateurCourant();
  if (!user) return null;
  const ligne = { id: user.id, pseudo: String(pseudo || '').trim().slice(0, 24) || 'Joueur', emoji };
  const { data, error } = await supabase.from(TABLE_PROFILS).upsert(ligne).select().maybeSingle();
  return error ? null : data;
}
