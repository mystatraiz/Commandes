import { TRUFFE, cuissonById, grilladeById } from '../config.js';
import { recapitulatif } from '../lib/recap.js';

/* Récapitulatif du grill.

   Ce que l'accueil montre commande par commande, cet écran le montre pièce par
   pièce : toutes les commandes en cours fondues en une seule liste, les
   morceaux identiques réunis. C'est la vue pour compter avant de charger le
   grill, pas pour suivre une table. */
export default function Recap({ commandes, onRetour }) {
  const { total, nbCommandes, groupes } = recapitulatif(commandes);

  return (
    <>
      <header className="topbar">
        <button className="btn btn-quiet btn-icon" type="button" onClick={onRetour} aria-label="Retour">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="title">
          Sur le grill
          <span className="sub">
            {nbCommandes
              ? `${nbCommandes} commande${nbCommandes > 1 ? 's' : ''} en cours`
              : 'Aucune commande en cours'}
          </span>
        </h1>
      </header>

      <div className="content">
        <div className="inner">
          {total === 0 ? (
            <div className="empty">
              <div className="big">🔥</div>
              <h2>Rien sur le grill</h2>
              <p>
                Dès qu’une commande est envoyée, toutes les pièces identiques
                sont réunies ici pour être comptées d’un coup d’œil.
              </p>
            </div>
          ) : (
            <>
              <div className="recap-total">
                <span className="n">{total}</span>
                <span className="l">pièce{total > 1 ? 's' : ''} à cuire</span>
              </div>

              <ul className="recap">
                {groupes.map((g) => {
                  const def = grilladeById(g.grillade);
                  return (
                    <li className="recap-groupe" key={g.grillade}>
                      <div className="recap-tete">
                        <span className="nom">{def ? def.nom : g.grillade}</span>
                        <span className="somme">{g.total}</span>
                      </div>
                      <ul className="recap-lignes">
                        {g.lignes.map((l, i) => {
                          const c = cuissonById(l.cuisson);
                          return (
                            <li key={i}>
                              <span
                                className="qty"
                                style={c ? { background: c.couleur, color: c.encre } : { background: 'var(--surface-3)' }}
                              >
                                {l.qte}
                              </span>
                              <span className="quoi">
                                {c ? c.nom : 'Sans cuisson'}
                                {l.truffe && <b className="truffe-tag">{TRUFFE.etiquette}</b>}
                              </span>
                              <span className="ou">
                                {l.tables.map((t) => `T${t}`).join(' ')}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}
