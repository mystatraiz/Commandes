import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as db from './db.js';
import * as sync from './sync.js';
import * as api from './defis.js';
import { syncActive, sessionCourante, supabase, deconnecter, lireProfil, ecrireProfil } from './supabase.js';
import { REGLAGES_DEFAUT, calculerXp, resume as calculerResume } from './lib/gamification.js';
import { jeuneEnCours } from './lib/jeune.js';
import { calculerProgres, aPublier, evenementAPublier, statutDefi, VISIBILITE_DEFAUT } from './lib/defis.js';
import { pesees } from './lib/series.js';
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
import Defis from './screens/Defis.jsx';
import CreerDefi from './screens/CreerDefi.jsx';
import RejoindreDefi from './screens/RejoindreDefi.jsx';
import Arene from './screens/Arene.jsx';

const nouvelId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const vibrer = (ms) => { try { navigator.vibrate?.(ms); } catch {} };
const ONGLETS = ['accueil', 'defis', 'jeune', 'sport', 'courbes', 'profil'];
const nb = (x) => (x === null || x === undefined || x === '' ? null : Number(x));

export default function App() {
  const [entrees, setEntrees] = useState([]);
  const [pret, setPret] = useState(false);
  const [connecte, setConnecte] = useState(!syncActive);
  const [etatSync, setEtatSync] = useState(sync.etatSync());
  const [profil, setProfil] = useState(null);
  const [emailCompte, setEmailCompte] = useState(null);
  const [defis, setDefis] = useState([]);
  const [defisEtat, setDefisEtat] = useState({ chargement: false, erreur: null });
  const [classements, setClassements] = useState({});   // defiId -> { lignes, erreur, chargement, depuisCache }
  const [fils, setFils] = useState({});                 // defiId -> { evenements, erreur, chargement }
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

  /* ---------------- Défis ---------------- */

  const chargerDefis = useCallback(async () => {
    if (!syncActive || !connecte) return;
    setDefisEtat((e) => ({ ...e, chargement: true }));
    const r = await api.mesDefis();
    const moi = (await sessionCourante())?.user?.id || null;
    const liste = (r.defis || []).map((d) => ({ ...d, estCreateur: d.createur === moi }));
    setDefis(liste);
    setDefisEtat({ chargement: false, erreur: r.ok ? null : r.message });
    // L'accueil montre le rang du défi en cours : il lui faut le classement.
    for (const d of liste) {
      if (statutDefi(d, Date.now()) === 'en_cours') chargerClassementRef.current?.(d.id);
    }
  }, [connecte]);

  // Référence plutôt qu'une dépendance : les deux chargements s'appellent l'un
  // l'autre, et se déclarer mutuellement ferait tourner les effets en boucle.
  const chargerClassementRef = useRef(null);

  const chargerClassement = useCallback(async (defiId) => {
    if (!syncActive) return;
    setClassements((c) => ({ ...c, [defiId]: { ...(c[defiId] || {}), chargement: true } }));
    const r = await api.classement(defiId);
    setClassements((c) => ({
      ...c,
      [defiId]: { lignes: r.lignes || [], erreur: r.ok ? null : r.message, depuisCache: r.depuisCache, chargement: false },
    }));
  }, []);
  chargerClassementRef.current = chargerClassement;

  const chargerFil = useCallback(async (defiId) => {
    if (!syncActive) return;
    setFils((f) => ({ ...f, [defiId]: { ...(f[defiId] || {}), chargement: true } }));
    const r = await api.fil(defiId);
    setFils((f) => ({
      ...f,
      [defiId]: { evenements: r.evenements || [], erreur: r.ok ? null : r.message, chargement: false },
    }));
  }, []);

  useEffect(() => {
    if (!syncActive || !connecte) return;
    lireProfil().then((p) => setProfil(p));
    sessionCourante().then((s) => setEmailCompte(s?.user?.email || null));
    chargerDefis();
  }, [connecte, chargerDefis]);

  // Le classement des autres bouge sans qu'on touche à rien.
  useEffect(() => {
    if (!syncActive || !connecte) return;
    return api.surChangement((quoi, defiId) => {
      if (quoi === 'classement') {
        if (defiId) chargerClassement(defiId); else chargerDefis();
        return;
      }
      // Réactions et vannes ne portent pas l'identifiant du défi : on
      // rafraîchit les fils déjà ouverts, seuls capables de les afficher.
      setFils((f) => { Object.keys(f).forEach((id) => chargerFil(id)); return f; });
    });
  }, [connecte, chargerClassement, chargerDefis, chargerFil]);

  /* Publication de la progression.

     L'appareil calcule à partir de ses seules pesées et n'envoie que ce que le
     réglage de visibilité autorise. On ne réécrit que si la valeur a bougé,
     sinon chaque écriture relancerait un rechargement, qui relancerait une
     écriture. */
  const jourCourant = cleJour(maintenant);
  useEffect(() => {
    if (!syncActive || !connecte || !defis.length) return;
    let vivant = true;
    (async () => {
      const mesPesees = pesees(vivantes).map((x) => ({ jour: x.jour, kg: x.donnees.kg }));
      let aRecharger = false;
      for (const d of defis) {
        if (!vivant) return;
        const progres = calculerProgres(mesPesees, d, Date.now());
        const envoi = aPublier(progres, d, d.participation?.visibilite || VISIBILITE_DEFAUT);
        const p = d.participation;
        const identique = nb(p?.valeur) === envoi.valeur && nb(p?.pct) === envoi.pct && nb(p?.kg) === envoi.kg;
        if (identique) continue;
        const r = await api.publier(d.id, envoi);
        if (!r.ok) continue;
        aRecharger = true;
        // La même pesée entre aussi dans le fil, filtrée pareil : c'est elle
        // qui trace les courbes et qui se commente.
        const evt = evenementAPublier(progres, d.participation?.visibilite || VISIBILITE_DEFAUT);
        if (evt && evt.jour >= d.debut && evt.jour <= d.fin) {
          await api.publierEvenement(d.id, {
            ...evt,
            pseudo: d.participation?.pseudo || profil?.pseudo || 'Joueur',
            emoji: d.participation?.emoji || profil?.emoji || '💪',
          });
          chargerFil(d.id);
        }
      }
      if (vivant && aRecharger) chargerDefis();
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vivantes, defis, connecte, jourCourant, profil, chargerFil]);

  const creerDefi = useCallback(async (champs) => {
    const r = await api.creer(champs);
    if (!r.ok) return r;
    await chargerDefis();
    fermerTout();
    setOnglet('defis');
    montrerToast(`Défi créé. Le code est ${r.defi.code}.`);
    return r;
  }, [chargerDefis, fermerTout, montrerToast]);

  const rejoindreDefi = useCallback(async (champs) => {
    const r = await api.rejoindre(champs);
    if (!r.ok) return r;
    await chargerDefis();
    fermerTout();
    setOnglet('defis');
    montrerToast('Te voilà dans la course.');
    return r;
  }, [chargerDefis, fermerTout, montrerToast]);

  const ouvrirArene = useCallback((defi) => {
    chargerClassement(defi.id);
    chargerFil(defi.id);
    ouvrir('arene', { defiId: defi.id });
  }, [chargerClassement, chargerFil, ouvrir]);

  const reglerVisibilite = useCallback(async (defiId, visibilite) => {
    const r = await api.reglerVisibilite(defiId, visibilite);
    if (!r.ok) { montrerToast(r.message); return; }
    await chargerDefis();
    chargerClassement(defiId);
    montrerToast('Visibilité mise à jour.');
  }, [chargerDefis, chargerClassement, montrerToast]);

  const quitterDefi = useCallback(async (defiId) => {
    const r = await api.quitter(defiId);
    if (!r.ok) { montrerToast(r.message); return; }
    await chargerDefis();
    fermerTout();
    setOnglet('defis');
    montrerToast('Défi quitté. Tes pesées restent.');
  }, [chargerDefis, fermerTout, montrerToast]);

  const reagir = useCallback(async (evenementId, emoji, actif, defiId) => {
    const r = await api.reagir(evenementId, emoji, actif);
    if (!r.ok) { montrerToast(r.message); return; }
    chargerFil(defiId);
  }, [chargerFil, montrerToast]);

  const commenter = useCallback(async (evenementId, texte, defiId) => {
    const defi = defis.find((d) => d.id === defiId);
    const r = await api.commenter(evenementId, {
      pseudo: defi?.participation?.pseudo || profil?.pseudo || 'Joueur',
      emoji: defi?.participation?.emoji || profil?.emoji || '💪',
      texte,
    });
    if (!r.ok) { montrerToast(r.message); return; }
    chargerFil(defiId);
  }, [defis, profil, chargerFil, montrerToast]);

  const supprimerCommentaire = useCallback(async (id, defiId) => {
    const r = await api.supprimerCommentaire(id);
    if (!r.ok) { montrerToast(r.message); return; }
    chargerFil(defiId);
  }, [chargerFil, montrerToast]);

  const majProfil = useCallback(async ({ pseudo, emoji }) => {
    const p = await ecrireProfil({ pseudo, emoji });
    if (p) setProfil(p);
    // Le pseudo est recopié dans chaque participation : on le répercute pour
    // que le classement n'affiche pas l'ancien.
    for (const d of defis) await api.majPseudo(d.id, { pseudo: p?.pseudo || pseudo, emoji });
    if (defis.length) chargerDefis();
    montrerToast('Profil mis à jour.');
  }, [defis, chargerDefis, montrerToast]);

  const cloreDefi = useCallback(async (defiId) => {
    const r = await api.clore(defiId);
    if (!r.ok) { montrerToast(r.message); return; }
    await chargerDefis();
    montrerToast('Défi clos.');
  }, [chargerDefis, montrerToast]);

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

  const modifierJeune = useCallback(async (j, patch) => {
    const modifie = { ...j, ...patch };
    await enregistrer(modifie);
    vibrer(12);
    // Corriger un jeûne change sa durée, donc l'XP et les courbes : on le dit.
    montrerToast(modifie.fin
      ? `Jeûne corrigé : ${formatHeures(dureeJeuneH(modifie))}`
      : 'Heure de début corrigée');
  }, [enregistrer, montrerToast]);

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
    a.download = `gros-sac-${cleJour()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, [vivantes]);

  const seDeconnecter = useCallback(async () => {
    await sync.arreter();
    await deconnecter();
    await db.vider();
    api.viderCache();
    setEntrees([]);
    setDefis([]);
    setClassements({});
    setFils({});
    setProfil(null);
    setEmailCompte(null);
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
  else if (ecran?.nom === 'creer-defi') vue = <CreerDefi profil={profil} maintenant={maintenant} onCreer={creerDefi} onRetour={retour} />;
  else if (ecran?.nom === 'rejoindre-defi') vue = <RejoindreDefi profil={profil} onApercu={api.apercu} onRejoindre={rejoindreDefi} onRetour={retour} />;
  else if (ecran?.nom === 'arene') {
    const defi = defis.find((d) => d.id === ecran.defiId);
    const c = classements[ecran.defiId] || {};
    if (!defi) vue = <div className="ecran"><div className="contenu"><p className="aide centre-texte">Ce défi n’est plus accessible.</p><button className="btn btn-ghost btn-block" type="button" onClick={retour}>Retour</button></div></div>;
    else {
      const mesPesees = pesees(vivantes).map((x) => ({ jour: x.jour, kg: x.donnees.kg }));
      vue = (
        <Arene
          defi={defi} classement={c.lignes || []} evenements={fils[ecran.defiId]?.evenements || []}
          monProgres={calculerProgres(mesPesees, defi, maintenant)}
          chargement={c.chargement} erreur={c.erreur} depuisCache={c.depuisCache} maintenant={maintenant}
          onReagir={(evtId, emoji, actif) => reagir(evtId, emoji, actif, defi.id)}
          onCommenter={(evtId, texte) => commenter(evtId, texte, defi.id)}
          onSupprimerCommentaire={(id) => supprimerCommentaire(id, defi.id)}
          onRetour={retour} onRafraichir={() => { chargerClassement(defi.id); chargerFil(defi.id); }}
          onVisibilite={(v) => reglerVisibilite(defi.id, v)}
          onQuitter={() => quitterDefi(defi.id)} onClore={() => cloreDefi(defi.id)}
          onPeser={() => ouvrir('poids')}
        />
      );
    }
  }
  else if (onglet === 'defis') vue = (
    <Defis
      defis={defis} chargement={defisEtat.chargement} erreur={defisEtat.erreur} maintenant={maintenant}
      onOuvrir={ouvrirArene} onCreer={() => ouvrir('creer-defi')} onRejoindre={() => ouvrir('rejoindre-defi')}
      onRafraichir={syncActive ? chargerDefis : null}
    />
  );
  else if (onglet === 'jeune') vue = <Jeune entrees={vivantes} reglages={reglages} maintenant={maintenant} onDemarrer={demarrerJeune} onTerminer={terminerJeune} onModifier={modifierJeune} onSupprimer={supprimer} />;
  else if (onglet === 'sport') vue = <Sport entrees={vivantes} resume={resume} maintenant={maintenant} onOuvrir={ouvrir} onSupprimer={supprimer} />;
  else if (onglet === 'courbes') vue = <Courbes entrees={vivantes} maintenant={maintenant} onOuvrirPoids={() => ouvrir('poids')} />;
  else if (onglet === 'profil') vue = <Profil resume={resume} reglages={reglages} etatSync={etatSync} profil={profil} email={emailCompte}
    onMajProfil={majProfil} onMajReglages={majReglages} onDeconnecter={seDeconnecter} onExporter={exporter} />;
  else vue = (
    <Accueil
      entrees={vivantes} reglages={reglages} resume={resume} maintenant={maintenant} etatSync={etatSync}
      defis={defis} classements={classements}
      onOnglet={changerOnglet} onOuvrir={ouvrir} onOuvrirDefi={ouvrirArene}
      onDemarrerJeune={demarrerJeune} onTerminerJeune={terminerJeune}
    />
  );

  return (
    <div className="app">
      {vue}
      {!ecran && <Nav onglet={onglet} onChange={changerOnglet} />}
      {toast && <Toast {...toast} onFermer={fermerToast} />}
      <MajPWA />
    </div>
  );
}
