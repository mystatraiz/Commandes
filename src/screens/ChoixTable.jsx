import { ZONES } from '../config.js';

/* Choix de la table.

   Toutes les tables sont posées à plat, groupées par zone et repérées par sa
   couleur : on vise directement son numéro au lieu de le chercher en faisant
   défiler. Un appui vaut choix et passe à la suite — pas de validation
   séparée, c'est le geste d'une calculatrice.

   Les tables qui ont déjà une commande en cours portent une pastille : utile
   pour reprendre une table servie en plusieurs fois, et pour repérer une
   erreur de numéro avant d'aller plus loin. */
export default function ChoixTable({ onChoisir, onRetour, occupees = {} }) {
  return (
    <>
      <header className="topbar">
        <button className="btn btn-quiet btn-icon" type="button" onClick={onRetour} aria-label="Annuler">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="title">
          Nouvelle commande
          <span className="sub">Étape 1 sur 2 — choisissez la table</span>
        </h1>
      </header>

      <div className="content">
        <div className="inner">
          {ZONES.map((zone) => (
            <section className="zone" key={zone.id} style={{ '--zone': zone.couleur }}>
              <h2 className="zone-titre">
                <i aria-hidden="true" />
                {zone.nom}
              </h2>
              <div className="pave" role="group" aria-label={`Tables — ${zone.nom}`}>
                {zone.tables.map((t) => (
                  <button
                    key={t}
                    className={`touche ${occupees[t] ? 'occupee' : ''}`}
                    type="button"
                    onClick={() => onChoisir(t)}
                    aria-label={
                      `Table ${t}, ${zone.nom}` +
                      (occupees[t] ? ` — ${occupees[t]} commande${occupees[t] > 1 ? 's' : ''} en cours` : '')
                    }
                  >
                    {t}
                    {occupees[t] > 0 && <span className="pastille" aria-hidden="true">{occupees[t]}</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
