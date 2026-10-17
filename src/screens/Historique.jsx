import { useCallback, useEffect, useState } from 'react';
import { TRUFFE, cuissonById, grilladeById } from '../config.js';
import { toutesLesCommandes } from '../db.js';
import { debutDeJournee, formatDuree } from '../lib/temps.js';

const heure = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/* Historique du jour.

   Une commande marquée servie disparaît de l'accueil, et une commande effacée
   aussi — mais ni l'une ni l'autre n'est détruite. Les deux atterrissent ici,
   où elles se remettent en cours d'un appui. C'est le filet pour les deux
   fausses manœuvres les plus probables en plein service. */
export default function Historique({ onRestaurer, onRetour, rafraichir }) {
  const [commandes, setCommandes] = useState(null);

  const charger = useCallback(async () => {
    const tout = await toutesLesCommandes();
    const depuis = debutDeJournee();
    setCommandes(
      tout
        .filter((c) => c.creeeA >= depuis && c.statut !== 'en_cours')
        .sort((a, b) => (b.servieA || b.creeeA) - (a.servieA || a.creeeA)),
    );
  }, []);

  useEffect(() => { charger(); }, [charger, rafraichir]);

  const restaurer = async (cmd) => {
    await onRestaurer(cmd.id);
    charger();
  };

  return (
    <>
      <header className="topbar">
        <button className="btn btn-quiet btn-icon" type="button" onClick={onRetour} aria-label="Retour">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="title">
          Historique du jour
          <span className="sub">
            {commandes === null
              ? 'Lecture…'
              : commandes.length
                ? `${commandes.length} commande${commandes.length > 1 ? 's' : ''} depuis ce matin`
                : 'Rien pour l’instant'}
          </span>
        </h1>
      </header>

      <div className="content">
        <div className="inner">
          {commandes === null ? null : commandes.length === 0 ? (
            <div className="empty">
              <div className="big">🕑</div>
              <h2>Aucune commande terminée</h2>
              <p>
                Les commandes servies ou effacées de la journée s’affichent ici.
                Si l’une d’elles l’a été par erreur, vous pourrez la remettre en cours.
              </p>
            </div>
          ) : (
            <ul className="histo">
              {commandes.map((cmd) => {
                const pieces = cmd.lignes.reduce((s, l) => s + l.qte, 0);
                const annulee = cmd.statut === 'annulee';
                return (
                  <li className={`histo-item ${annulee ? 'annulee' : 'servie'}`} key={cmd.id}>
                    <div className="histo-tete">
                      <span className="histo-table">Table {cmd.table}</span>
                      <span className={`histo-etat ${annulee ? 'annulee' : 'servie'}`}>
                        {annulee ? 'Effacée' : 'Servie'}
                      </span>
                    </div>

                    <p className="histo-detail">
                      {pieces} pièce{pieces > 1 ? 's' : ''} · prise à {heure(cmd.creeeA)}
                      {!annulee && cmd.servieA && ` · servie à ${heure(cmd.servieA)}`}
                      {!annulee && cmd.servieA > cmd.creeeA && ` · ${formatDuree(cmd.servieA - cmd.creeeA)}`}
                    </p>

                    <p className="histo-lignes">
                      {cmd.lignes.map((l, i) => {
                        const g = grilladeById(l.grillade);
                        const c = cuissonById(l.cuisson);
                        return (
                          <span className="histo-ligne" key={i}>
                            <b>{l.qte}</b> {g ? g.nom : l.grillade}
                            {l.truffe && <em>{TRUFFE.etiquette}</em>}
                            {c && <i style={{ background: c.couleur }} title={c.nom} />}
                          </span>
                        );
                      })}
                    </p>

                    <button className="btn btn-ghost" type="button" onClick={() => restaurer(cmd)}>
                      ↺ Remettre en cours
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
