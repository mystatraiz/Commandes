import { useCallback, useEffect, useRef, useState } from 'react';
import { RETENTION_JOURS } from './config.js';
import * as db from './db.js';
import * as sync from './sync.js';
import { partageActif, sessionCourante, supabase } from './supabase.js';
import Accueil from './screens/Accueil.jsx';
import ChoixTable from './screens/ChoixTable.jsx';
import Connexion from './screens/Connexion.jsx';
import Dictee from './screens/Dictee.jsx';
import Historique from './screens/Historique.jsx';
import Saisie from './screens/Saisie.jsx';
import Stats from './screens/Stats.jsx';
import { dicteeDisponible } from './lib/micro.js';
import Toast from './components/Toast.jsx';
import MajPWA from './components/MajPWA.jsx';

const nouvelId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const vibrer = (ms) => { try { navigator.vibrate?.(ms); } catch {} };

const BROUILLON_VIDE = { table: null, lignes: [] };

export default function App() {
  // Pile d'écrans, adossée à l'historique du navigateur pour que le bouton
  // « retour » d'Android recule d'un écran au lieu de quitter l'application.
  const [pile, setPile] = useState(['accueil']);
  const ecran = pile[pile.length - 1];

  const [commandes, setCommandes] = useState([]);   // uniquement celles en cours
  const [pret, setPret] = useState(false);
  const [connecte, setConnecte] = useState(!partageActif);   // sans partage, rien à demander
  const [etatSync, setEtatSync] = useState(sync.etatSync());
  const [brouillon, setBrouillon] = useState(BROUILLON_VIDE);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(0);

  /* ---------------- Navigation ---------------- */

  useEffect(() => {
    window.history.replaceState({ profondeur: 1 }, '');
    const surRetour = (e) => {
      const p = e.state?.profondeur ?? 1;
      setPile((ancienne) => (p < ancienne.length ? ancienne.slice(0, p) : ancienne));
    };
    window.addEventListener('popstate', surRetour);
    return () => window.removeEventListener('popstate', surRetour);
  }, []);

  const pousser = useCallback((nom) => {
    setPile((p) => {
      window.history.pushState({ profondeur: p.length + 1 }, '');
      return [...p, nom];
    });
  }, []);

  const retour = useCallback(() => window.history.back(), []);

  const allerAccueil = useCallback(() => {
    setPile((p) => {
      if (p.length > 1) window.history.go(-(p.length - 1));
      return p;
    });
  }, []);

  /* ---------------- Messages ---------------- */

  const montrerToast = useCallback((texte, action) => {
    clearTimeout(toastTimer.current);
    setToast({ texte, action });
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 3200);
  }, []);
  const fermerToast = useCallback(() => { clearTimeout(toastTimer.current); setToast(null); }, []);

  /* ---------------- Lecture des commandes en cours ---------------- */

  const recharger = useCallback(async () => {
    const toutes = await db.toutesLesCommandes();
    setCommandes(
      toutes.filter((c) => c.statut === 'en_cours').sort((a, b) => a.creeeA - b.creeeA),
    );
  }, []);

  /** Écrit localement puis pousse : l'écriture locale ne dépend jamais du réseau. */
  const enregistrer = useCallback(async (cmd) => {
    await db.enregistrer({ ...cmd, majA: Date.now(), synchro: false });
    await recharger();
    sync.synchroniser();
  }, [recharger]);

  /* ---------------- Démarrage ---------------- */

  useEffect(() => {
    let vivant = true;
    (async () => {
      if (partageActif) {
        const session = await sessionCourante();
        if (!vivant) return;
        if (!session) { setPret(true); setConnecte(false); return; }
        setConnecte(true);
      }
      await recharger();
      if (!vivant) return;
      setPret(true);

      // Un brouillon signifie que l'application s'est arrêtée en pleine saisie.
      const b = db.lireBrouillon();
      if (b && (b.table || b.lignes.length)) {
        setBrouillon(b);
        pousser(b.table ? 'saisie' : 'table');
        montrerToast('Commande en cours restaurée');
      }
      db.purger(Date.now() - RETENTION_JOURS * 86400000).catch(() => {});
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecte]);

  // Synchronisation : démarre une fois connecté, et rafraîchit l'écran dès
  // qu'une commande arrive d'un autre téléphone.
  useEffect(() => {
    if (!partageActif || !connecte) return;
    const desabonner = sync.surChangement((e) => { setEtatSync(e); recharger(); });
    sync.demarrer();
    return () => { desabonner(); };
  }, [connecte, recharger]);

  // Une session expirée ramène à l'écran du code plutôt qu'à une page muette.
  useEffect(() => {
    if (!partageActif || !supabase) return;
    const { data } = supabase.auth.onAuthStateChange((evenement) => {
      if (evenement === 'SIGNED_OUT') { sync.arreter(); setConnecte(false); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Le brouillon est réécrit à chaque geste : c'est lui qui sauve la saisie
  // si l'écran se verrouille ou si l'application est tuée en plein service.
  useEffect(() => {
    if (!pret) return;
    db.ecrireBrouillon(brouillon.table || brouillon.lignes.length ? brouillon : null);
  }, [brouillon, pret]);

  /* ---------------- Saisie d'une commande ---------------- */

  const commencer = useCallback(() => {
    setBrouillon(BROUILLON_VIDE);
    pousser('table');
  }, [pousser]);

  const choisirTable = useCallback((table) => {
    vibrer(12);
    setBrouillon((b) => ({ ...b, table }));
    pousser('saisie');
  }, [pousser]);

  const dicter = useCallback(() => {
    setBrouillon(BROUILLON_VIDE);
    pousser('dictee');
  }, [pousser]);

  /* La dictée ne fait que pré-remplir : on atterrit sur l'écran de saisie
     habituel, où la commande se relit et se corrige avant d'être envoyée. */
  const reprendreDictee = useCallback((resultat) => {
    setBrouillon({
      table: resultat.table,
      lignes: resultat.lignes.map(({ grillade, cuisson, qte, truffe }) =>
        truffe ? { grillade, cuisson, qte, truffe: true } : { grillade, cuisson, qte }),
    });
    // L'écran de dictée cède sa place au pavé, puis la saisie s'empile
    // par-dessus : revenir en arrière ramène au choix de table en gardant la
    // commande, ce qui permet de rattraper un numéro mal entendu. Relancer le
    // micro par mégarde, en revanche, n'aurait aucun intérêt.
    setPile((p) => {
      const base = [...p.slice(0, -1), 'table'];
      window.history.pushState({ profondeur: base.length + 1 }, '');
      return [...base, 'saisie'];
    });
  }, []);

  /** Ajoute une pièce. Deux pièces ne se cumulent que si elles sont
      identiques en tout — la truffe fait partie de cette identité, sinon une
      côte truffée disparaîtrait dans le compte d'une côte ordinaire. */
  const ajouter = useCallback((grillade, cuisson, truffe = false) => {
    vibrer(10);
    setBrouillon((b) => {
      const i = b.lignes.findIndex(
        (l) => l.grillade === grillade && l.cuisson === cuisson && Boolean(l.truffe) === Boolean(truffe),
      );
      if (i === -1) {
        const ligne = { grillade, cuisson, qte: 1 };
        if (truffe) ligne.truffe = true;
        return { ...b, lignes: [...b.lignes, ligne] };
      }
      const lignes = b.lignes.slice();
      lignes[i] = { ...lignes[i], qte: lignes[i].qte + 1 };
      return { ...b, lignes };
    });
  }, []);

  /** Retire une pièce ; la ligne disparaît quand elle tombe à zéro. */
  const retirer = useCallback((index) => {
    vibrer(8);
    setBrouillon((b) => {
      const lignes = b.lignes.slice();
      const l = lignes[index];
      if (!l) return b;
      if (l.qte > 1) lignes[index] = { ...l, qte: l.qte - 1 };
      else lignes.splice(index, 1);
      return { ...b, lignes };
    });
  }, []);

  const envoyer = useCallback(async () => {
    if (!brouillon.table || !brouillon.lignes.length) return;
    const cmd = {
      id: nouvelId(),
      table: brouillon.table,
      lignes: brouillon.lignes,
      creeeA: Date.now(),
      servieA: null,
      statut: 'en_cours',
    };
    setBrouillon(BROUILLON_VIDE);
    db.ecrireBrouillon(null);
    await enregistrer(cmd);
    vibrer(24);
    allerAccueil();
    const n = cmd.lignes.reduce((s, l) => s + l.qte, 0);
    montrerToast(`Table ${cmd.table} — ${n} pièce${n > 1 ? 's' : ''}`);
  }, [brouillon, allerAccueil, montrerToast, enregistrer]);

  const abandonner = useCallback(() => {
    setBrouillon(BROUILLON_VIDE);
    db.ecrireBrouillon(null);
    allerAccueil();
  }, [allerAccueil]);

  /* ---------------- Effacer et restaurer ---------------- */

  /* Une commande effacée n'est pas détruite : elle passe en « annulée ».
     Deux raisons. Elle reste restaurable depuis l'historique du jour, et une
     suppression de ligne ne se propagerait pas aux téléphones hors ligne,
     alors qu'un changement de statut suit la synchronisation habituelle. */
  const effacer = useCallback(async (id) => {
    const cmd = commandes.find((c) => c.id === id);
    if (!cmd) return;
    await enregistrer({ ...cmd, statut: 'annulee', servieA: Date.now() });
    vibrer(22);
    montrerToast(`Table ${cmd.table} effacée`, {
      libelle: 'Annuler',
      faire: () => enregistrer({ ...cmd, statut: 'en_cours', servieA: null }),
    });
  }, [commandes, montrerToast, enregistrer]);

  const restaurer = useCallback(async (id) => {
    const toutes = await db.toutesLesCommandes();
    const cmd = toutes.find((c) => c.id === id);
    if (!cmd) return;
    await enregistrer({ ...cmd, statut: 'en_cours', servieA: null });
    vibrer(18);
    montrerToast(`Table ${cmd.table} remise en cours`);
  }, [montrerToast, enregistrer]);

  /* ---------------- Commande servie ---------------- */

  const servir = useCallback(async (id) => {
    const cmd = commandes.find((c) => c.id === id);
    if (!cmd) return;
    await enregistrer({ ...cmd, statut: 'servie', servieA: Date.now() });
    vibrer(18);
    montrerToast(`Table ${cmd.table} servie`, {
      libelle: 'Annuler',
      faire: () => enregistrer({ ...cmd, statut: 'en_cours', servieA: null }),
    });
  }, [commandes, montrerToast, enregistrer]);

  /* ---------------- Rendu ---------------- */

  // Tables qui ont déjà une commande en cours, affichées en pastille.
  const occupees = {};
  for (const c of commandes) occupees[c.table] = (occupees[c.table] || 0) + 1;


  if (!pret) return <div className="app" />;

  if (partageActif && !connecte) {
    return (
      <div className="app">
        <Connexion onConnecte={() => setConnecte(true)} />
        <MajPWA />
      </div>
    );
  }

  return (
    <div className="app">
      {ecran === 'accueil' && (
        <Accueil
          commandes={commandes}
          etatSync={etatSync}
          onNouvelle={commencer}
          onDicter={dicteeDisponible ? dicter : null}
          onServir={servir}
          onEffacer={effacer}
          onStats={() => pousser('stats')}
          onHistorique={() => pousser('historique')}
        />
      )}

      {ecran === 'table' && (
        <ChoixTable onChoisir={choisirTable} onRetour={abandonner} occupees={occupees} />
      )}

      {ecran === 'saisie' && (
        <Saisie
          brouillon={brouillon}
          onAjouter={ajouter}
          onRetirer={retirer}
          onEnvoyer={envoyer}
          onRetour={retour}
          onChangerTable={retour}
        />
      )}

      {ecran === 'dictee' && <Dictee onValider={reprendreDictee} onRetour={retour} />}

      {ecran === 'historique' && (
        <Historique onRestaurer={restaurer} onRetour={retour} rafraichir={commandes.length} />
      )}

      {ecran === 'stats' && <Stats commandesEnCours={commandes} onRetour={retour} />}

      {toast && <Toast {...toast} onFermer={fermerToast} />}
      <MajPWA />
    </div>
  );
}
