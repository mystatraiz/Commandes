import { useCallback, useEffect, useRef, useState } from 'react';
import { RETENTION_JOURS, TABLES } from './config.js';
import * as db from './db.js';
import * as sync from './sync.js';
import { partageActif, sessionCourante, supabase } from './supabase.js';
import Accueil from './screens/Accueil.jsx';
import ChoixTable from './screens/ChoixTable.jsx';
import Connexion from './screens/Connexion.jsx';
import Saisie from './screens/Saisie.jsx';
import Stats from './screens/Stats.jsx';
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
    setBrouillon({ table: TABLES[0], lignes: [] });
    pousser('table');
  }, [pousser]);

  const choisirTable = useCallback((table) => setBrouillon((b) => ({ ...b, table })), []);

  const validerTable = useCallback(() => { vibrer(12); pousser('saisie'); }, [pousser]);

  /** Ajoute une pièce ; deux fois la même viande et la même cuisson se cumulent. */
  const ajouter = useCallback((grillade, cuisson) => {
    vibrer(10);
    setBrouillon((b) => {
      const i = b.lignes.findIndex((l) => l.grillade === grillade && l.cuisson === cuisson);
      if (i === -1) return { ...b, lignes: [...b.lignes, { grillade, cuisson, qte: 1 }] };
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
          onServir={servir}
          onStats={() => pousser('stats')}
        />
      )}

      {ecran === 'table' && (
        <ChoixTable
          valeur={brouillon.table || TABLES[0]}
          onChange={choisirTable}
          onValider={validerTable}
          onRetour={abandonner}
        />
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

      {ecran === 'stats' && <Stats commandesEnCours={commandes} onRetour={retour} />}

      {toast && <Toast {...toast} onFermer={fermerToast} />}
      <MajPWA />
    </div>
  );
}
