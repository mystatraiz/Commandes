import { useCallback, useEffect, useRef, useState } from 'react';
import { RETENTION_JOURS, TABLES } from './config.js';
import * as db from './db.js';
import Accueil from './screens/Accueil.jsx';
import ChoixTable from './screens/ChoixTable.jsx';
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

  /* ---------------- Chargement ---------------- */

  useEffect(() => {
    let vivant = true;
    (async () => {
      const toutes = await db.toutesLesCommandes();
      if (!vivant) return;
      setCommandes(
        toutes.filter((c) => c.statut === 'en_cours').sort((a, b) => a.creeeA - b.creeeA),
      );
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
  }, []);

  // Le brouillon est réécrit à chaque geste : c'est lui qui sauve la saisie
  // si l'écran se verrouille ou si l'application est tuée en plein service.
  useEffect(() => {
    if (!pret) return;
    db.ecrireBrouillon(brouillon.table || brouillon.lignes.length ? brouillon : null);
  }, [brouillon, pret]);

  /* ---------------- Messages ---------------- */

  const montrerToast = useCallback((texte, action) => {
    clearTimeout(toastTimer.current);
    setToast({ texte, action });
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 3200);
  }, []);
  const fermerToast = useCallback(() => { clearTimeout(toastTimer.current); setToast(null); }, []);

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
    await db.enregistrer(cmd);
    setCommandes((c) => [...c, cmd]);
    setBrouillon(BROUILLON_VIDE);
    db.ecrireBrouillon(null);
    vibrer(24);
    allerAccueil();
    const n = cmd.lignes.reduce((s, l) => s + l.qte, 0);
    montrerToast(`Table ${cmd.table} — ${n} pièce${n > 1 ? 's' : ''}`);
  }, [brouillon, allerAccueil, montrerToast]);

  const abandonner = useCallback(() => {
    setBrouillon(BROUILLON_VIDE);
    db.ecrireBrouillon(null);
    allerAccueil();
  }, [allerAccueil]);

  /* ---------------- Commande servie ---------------- */

  const servir = useCallback(async (id) => {
    const cmd = commandes.find((c) => c.id === id);
    if (!cmd) return;
    const servie = { ...cmd, statut: 'servie', servieA: Date.now() };
    await db.enregistrer(servie);           // conservée pour les statistiques
    setCommandes((c) => c.filter((x) => x.id !== id));
    vibrer(18);
    montrerToast(`Table ${cmd.table} servie`, {
      libelle: 'Annuler',
      faire: async () => {
        const reprise = { ...cmd, statut: 'en_cours', servieA: null };
        await db.enregistrer(reprise);
        setCommandes((c) => [...c, reprise].sort((a, b) => a.creeeA - b.creeeA));
      },
    });
  }, [commandes, montrerToast]);

  /* ---------------- Rendu ---------------- */

  if (!pret) return <div className="app" />;

  return (
    <div className="app">
      {ecran === 'accueil' && (
        <Accueil
          commandes={commandes}
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
