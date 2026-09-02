import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as db from './db.js';
import * as sync from './sync.js';
import { syncActive, sessionCourante, supabase, deconnecter } from './supabase.js';
import { REGLAGES_DEFAUT, calculerXp, resume as calculerResume } from './lib/gamification.js';
import { jeuneEnCours } from './lib/jeune.js';
import { ECHAUFFEMENT_PADEL, dureeEchauffementS } from './lib/echauffement.js';
import { cleJour, useHorloge, formatHeures } from './lib/temps.js';
import { dureeJeuneH } from './lib/jeune.js';
import Nav from './components/Nav.jsx';
import Toast from './components/Toast.jsx';
import MajPWA from './components/MajPWA.jsx';
import Connexion from './screens/Connexion.jsx';
import Accueil from './screens/Accueil.jsx';
import Jeune from './screens/Jeune.jsx';
import Poids from './screens/Poids.jsx';
import Sport from './screens/Sport.jsx';
import FormSession from './screens/FormSession.jsx';
import Renfo from './screens/Renfo.jsx';
import Echauffement from './screens/Echauffement.jsx';
import Lecteur from './screens/Lecteur.jsx';
import Courbes from './screens/Courbes.jsx';
import Profil from './screens/Profil.jsx';

const nouvelId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const vibrer = (ms) => { try { navigator.vibrate?.(ms); } catch {} };
const ONGLETS = ['accueil', 'jeune', 'sport', 'courbes', 'profil'];

export default function App() {
  const [entrees, setEntrees] = useState([]);
  const [pret, setPret] = useState(false);
  const [connecte, setConnecte] = useState(!syncActive);
  const [etatSync, setEtatSync] = useState(sync.etatSync());
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(0);

  // Onglet courant + pile d'écrans poussés par-dessus, adossée à l'historique
  // du navigateur pour que « retour » sur Android recule au lieu de quitter.
  const [onglet, setOnglet] = useState('accueil');
  const [pile, setPile] = useState([]);
  const ecran = pile[pile.length - 1] || null;

  const maintenant = useHorloge(1000);
  const minute = Math.floor(maintenant / 60000);

  /* ---------------- Navigation ---------------- */

  useEffect(() => {
    window.history.replaceState({ profondeur: 0 }, '');
    const surRetour = (e) => {
      const p = e.state?.profondeur ?? 0;
      setPile((ancienne) => (p < ancienne.length ? ancienne.slice(0, p) : ancienne));
    };
    window.addEventListener('popstate', surRetour);
    return () => window.removeEventListener('popstate', surRetour);
  }, []);

  const ouvrir = useCallback((nom, params = {}) => {
    setPile((p) => {
      window.history.pushState({ profondeur: p.length + 1 }, '');
      return [...p, { nom, ...params }];
    });
  }, []);
  const retour = useCallback(() => window.history.back(), []);
  const fermerTout = useCallback(() => {
    setPile((p) => {
      if (p.length > 0) window.history.go(-p.length);
      return p;
    });
  }, []);
  const remplacer = useCallback((nom, params = {}) => setPile((p) => [...p.slice(0, -1), { nom, ...params }]), []);
  const changerOnglet = useCallback((id) => { if (ONGLETS.includes(id)) { fermerTout(); setOnglet(id); } }, [fermerTout]);

  /* ---------------- Messages ---------------- */

  const montrerToast = useCallback((texte, options = {}) => {
    clearTimeout(toastTimer.current);
    setToast({ texte, ...options });
    toastTimer.current = setTimeout(() => setToast(null), options.action ? 6000 : 3200);
  }, []);
  const fermerToast = useCallback(() => { clearTimeout(toastTimer.current); setToast(null); }, []);

  /* ---------------- Données ---------------- */

  const vivantes = useMemo(() => entrees.filter((e) => !e.supprime), [entrees]);
  const reglages = useMemo(() => {
    const r = vivantes.find((e) => e.type === 'reglages');
    return { ...REGLAGES_DEFAUT, ...(r?.donnees || {}) };
  }, [vivantes]);
  // Recalculé chaque minute : les missions liées au jeûne peuvent basculer sans autre geste.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resume = useMemo(() => calculerResume(vivantes, reglages, maintenant), [vivantes, reglages, minute]);

  const recharger = useCallback(async () => setEntrees(await db.toutesLesEntrees()), []);

  /** Écrit localement puis pousse ; renvoie l'XP gagnée par ce geste. */
  const enregistrer = useCallback(async (entree) => {
    const avant = calculerXp(vivantes, reglages).total;
    const complete = { supprime: false, ...entree, id: entree.id || nouvelId(), majA: Date.now(), synchro: false };
    await db.enregistrer(complete);
    const toutes = await db.toutesLesEntrees();
    setEntrees(toutes);
    sync.synchroniser();
    const apres = calculerXp(toutes.filter((e) => !e.supprime), reglages).total;
    return Math.max(0, apres - avant);
  }, [vivantes, reglages]);

  const supprimer = useCallback(async (id) => {
    const e = entrees.find((x) => x.id === id);
    if (!e) return;
    await enregistrer({ ...e, supprime: true });
    montrerToast('Supprimé', { action: { libelle: 'Annuler', faire: () => enregistrer({ ...e, supprime: false }) } });
  }, [entrees, enregistrer, montrerToast]);

  const majReglages = useCallback(async (patch) => {
    await enregistrer({ id: 'reglages', type: 'reglages', jour: null, debut: null, fin: null, donnees: { ...reglages, ...patch } });
  }, [enregistrer, reglages]);

  /* ---------------- Démarrage ---------------- */

  useEffect(() => {
    let vivant = true;
    (async () => {
      if (syncActive) {
        const session = await sessionCourante();
        if (!vivant) return;
        if (!session) { setPret(true); setConnecte(false); return; }
        setConnecte(true);
      }
      await recharger();
      if (vivant) setPret(true);
    })();
    return () => { vivant = false; };
  }, [connecte, recharger]);

  useEffect(() => {
    if (!syncActive || !connecte) return;
    const desabonner = sync.surChangement((e) => { setEtatSync(e); recharger(); });
    sync.demarrer();
    return () => desabonner();
  }, [connecte, recharger]);

  useEffect(() => {
    if (!syncActive || !supabase) return;
    const { data } = supabase.auth.onAuthStateChange((evenement) => {
      if (evenement === 'SIGNED_OUT') { sync.arreter(); setConnecte(false); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  /* ---------------- Jeûne ---------------- */

  const demarrerJeune = useCallback(async (objectifH, debut = Date.now()) => {
    if (jeuneEnCours(vivantes)) return;
    await enregistrer({ type: 'jeune', jour: cleJour(debut), debut, fin: null, donnees: { objectifH } });
    vibrer(20);
    montrerToast(`Jeûne lancé · objectif ${objectifH} h. Tiens bon.`);
  }, [vivantes, enregistrer, montrerToast]);

  const terminerJeune = useCallback(async (j) => {
    const fini = { ...j, fin: Date.now() };
    const xp = await enregistrer(fini);
    vibrer(30);
    const h = dureeJeuneH(fini);
    const obj = Number(j.donnees?.objectifH) || 16;
    montrerToast(h >= obj ? `${formatHeures(h)} : objectif atteint.` : `${formatHeures(h)} de jeûne. On fera mieux.`, { xp });
  }, [enregistrer, montrerToast]);

  const modifierJeune = useCallback((j, patch) => enregistrer({ ...j, ...patch }), [enregistrer]);

  /* ---------------- Poids & sessions ---------------- */

  const enregistrerPoids = useCallback(async (kg, jour) => {
    const existante = vivantes.find((e) => e.type === 'poids' && e.jour === jour);
    const xp = await enregistrer({ ...(existante || { type: 'poids' }), jour, donnees: { ...(existante?.donnees || {}), kg } });
    vibrer(15);
    retour();
    montrerToast(`${kg.toLocaleString('fr-FR')} kg enregistré`, { xp });
  }, [vivantes, enregistrer, montrerToast, retour]);

  const enregistrerSession = useCallback(async (entree) => {
    const xp = await enregistrer(entree);
    vibrer(25);
    retour();
    montrerToast(entree.id ? 'Session modifiée' : 'Session enregistrée. Bien joué.', { xp: entree.id ? 0 : xp });
  }, [enregistrer, montrerToast, retour]);

  const lancerCircuit = useCallback((plan) => {
    remplacer('lecteur', { plan: { ...plan, titre: plan.circuit.nom, sport: 'renfo' } });
  }, [remplacer]);

  const lancerEchauffement = useCallback(() => {
    remplacer('lecteur', { plan: { titre: ECHAUFFEMENT_PADEL.nom, sport: 'echauffement', etapes: ECHAUFFEMENT_PADEL.etapes, dureeS: dureeEchauffementS(), tours: 1 } });
  }, [remplacer]);

  const terminerLecteur = useCallback(async ({ dureeMin, calories, etapesFaites }) => {
    const plan = ecran?.plan;
    const debut = Date.now() - dureeMin * 60000;
    const donnees = plan.sport === 'renfo'
      ? { sport: 'renfo', dureeMin, calories, intensite: 3, circuit: { id: plan.circuit.id, nom: plan.circuit.nom, tours: plan.tours, minutes: plan.minutes, exercices: plan.exercices.map((e) => e.nom), etapesFaites } }
      : { sport: 'echauffement', dureeMin, calories: 0, etapesFaites };
    const xp = await enregistrer({ type: 'sport', jour: cleJour(debut), debut, fin: Date.now(), donnees });
    fermerTout();
    setOnglet('sport');
    montrerToast(plan.sport === 'renfo' ? `${plan.circuit.nom} terminé.` : 'Échauffé. Va gagner.', { xp });
  }, [ecran, enregistrer, fermerTout, montrerToast]);

  /* ---------------- Export ---------------- */

  const exporter = useCallback(() => {
    const blob = new Blob([JSON.stringify(vivantes, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `forge-${cleJour()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, [vivantes]);

  const seDeconnecter = useCallback(async () => {
    await sync.arreter();
    await deconnecter();
    await db.vider();
    setEntrees([]);
    setConnecte(false);
  }, []);

  /* ---------------- Rendu ---------------- */

  if (!pret) return <div className="app" />;

  if (syncActive && !connecte) {
    return (
      <div className="app">
        <Connexion onConnecte={() => setConnecte(true)} />
        <MajPWA />
      </div>
    );
  }

  let vue;
  if (ecran?.nom === 'poids') vue = <Poids entrees={vivantes} reglages={reglages} maintenant={maintenant} onEnregistrer={enregistrerPoids} onSupprimer={supprimer} onRetour={retour} />;
  else if (ecran?.nom === 'session') vue = <FormSession entree={ecran.entree} sport={ecran.sport} onEnregistrer={enregistrerSession} onRetour={retour} />;
  else if (ecran?.nom === 'renfo') vue = <Renfo onLancer={lancerCircuit} onRetour={retour} />;
  else if (ecran?.nom === 'echauffement') vue = <Echauffement onLancer={lancerEchauffement} onRetour={retour} />;
  else if (ecran?.nom === 'lecteur') vue = <Lecteur key={ecran.plan.titre} plan={ecran.plan} reglages={reglages} onTerminer={terminerLecteur} onQuitter={retour} />;
  else if (onglet === 'jeune') vue = <Jeune entrees={vivantes} reglages={reglages} maintenant={maintenant} onDemarrer={demarrerJeune} onTerminer={terminerJeune} onModifier={modifierJeune} onSupprimer={supprimer} />;
  else if (onglet === 'sport') vue = <Sport entrees={vivantes} resume={resume} maintenant={maintenant} onOuvrir={ouvrir} onSupprimer={supprimer} />;
  else if (onglet === 'courbes') vue = <Courbes entrees={vivantes} maintenant={maintenant} onOuvrirPoids={() => ouvrir('poids')} />;
  else if (onglet === 'profil') vue = <Profil resume={resume} reglages={reglages} etatSync={etatSync} onMajReglages={majReglages} onDeconnecter={seDeconnecter} onExporter={exporter} />;
  else vue = <Accueil entrees={vivantes} reglages={reglages} resume={resume} maintenant={maintenant} etatSync={etatSync} onOnglet={changerOnglet} onOuvrir={ouvrir} onDemarrerJeune={demarrerJeune} onTerminerJeune={terminerJeune} />;

  return (
    <div className="app">
      {vue}
      {!ecran && <Nav onglet={onglet} onChange={changerOnglet} />}
      {toast && <Toast {...toast} onFermer={fermerToast} />}
      <MajPWA />
    </div>
  );
}
