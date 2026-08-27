import { useEffect, useState } from 'react';
import { CUISSONS, GRILLADES, cuissonById, grilladeById } from '../config.js';

/** Panneau des cuissons : quatre couleurs, une par degré de cuisson. */
function PanneauCuissons({ grillade, onChoisir, onFermer }) {
  // Échap ferme le panneau ; utile au clavier et sur les bornes.
  useEffect(() => {
    const surTouche = (e) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [onFermer]);

  return (
    <div
      className="sheet-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Cuisson pour ${grillade.nom}`}
    >
      <div className="sheet">
        <div className="grab" />
        <h2>{grillade.nom}</h2>
        <p className="hint">Choisissez la cuisson</p>
        <div className="cuissons">
          {CUISSONS.map((c) => (
            <button
              key={c.id}
              className="cuisson-btn"
              type="button"
              style={{ background: c.couleur, color: c.encre }}
              onClick={() => onChoisir(c.id)}
            >
              <span className="dot" aria-hidden="true" />
              {c.nom}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Saisie({ brouillon, onAjouter, onRetirer, onEnvoyer, onChangerTable }) {
  const [enAttente, setEnAttente] = useState(null);   // grillade dont on choisit la cuisson

  const pieces = brouillon.lignes.reduce((s, l) => s + l.qte, 0);

  // Compteur par grillade, affiché en pastille sur chaque bouton.
  const parGrillade = {};
  for (const l of brouillon.lignes) parGrillade[l.grillade] = (parGrillade[l.grillade] || 0) + l.qte;

  const choisirGrillade = (g) => {
    // Le poulet n'a pas de cuisson : il part directement dans la commande.
    if (g.sansCuisson) onAjouter(g.id, null);
    else setEnAttente(g);
  };

  const choisirCuisson = (cuissonId) => {
    onAjouter(enAttente.id, cuissonId);
    setEnAttente(null);   // retour immédiat à la liste des grillades
  };

  return (
    <>
      <header className="topbar">
        <button
          className="btn btn-quiet btn-icon"
          type="button"
          onClick={onChangerTable}
          aria-label="Changer de table"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="title">
          Table {brouillon.table}
          <span className="sub">
            {pieces ? `${pieces} pièce${pieces > 1 ? 's' : ''} · appuyez pour ajouter` : 'Étape 2 sur 2 — les grillades'}
          </span>
        </h1>
      </header>

      <div className="content">
        <div className="inner">
          <div className="meats">
            {GRILLADES.map((g) => (
              <button
                key={g.id}
                className={`meat ${parGrillade[g.id] ? 'picked' : ''}`}
                type="button"
                onClick={() => choisirGrillade(g)}
              >
                {g.nom}
                {parGrillade[g.id] > 0 && <span className="count">{parGrillade[g.id]}</span>}
                {g.sansCuisson && <span className="tag">sans cuisson</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {brouillon.lignes.length > 0 && (
        <div className="basket">
          <div className="basket-head">
            <span>Commande en cours</span>
            <span>{pieces} pièce{pieces > 1 ? 's' : ''}</span>
          </div>
          <div className="chips">
            {brouillon.lignes.map((l, i) => {
              const g = grilladeById(l.grillade);
              const c = cuissonById(l.cuisson);
              return (
                <span className="chip" key={`${l.grillade}-${l.cuisson}-${i}`}>
                  <i className="pill" style={{ background: c ? c.couleur : 'var(--ink-mute)' }} aria-hidden="true" />
                  {l.qte > 1 && <span className="n">{l.qte}×</span>}
                  {g ? g.nom : l.grillade}
                  {c && ` · ${c.nom}`}
                  <button
                    className="x"
                    type="button"
                    onClick={() => onRetirer(i)}
                    aria-label={`Retirer une pièce : ${g ? g.nom : l.grillade}${c ? ` ${c.nom}` : ''}`}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="footer-bar">
        <button
          className="btn btn-primary btn-lg btn-block"
          type="button"
          disabled={pieces === 0}
          onClick={onEnvoyer}
        >
          Envoyer la commande{pieces > 0 ? ` · ${pieces}` : ''}
        </button>
      </div>

      {enAttente && (
        <PanneauCuissons
          grillade={enAttente}
          onChoisir={choisirCuisson}
          onFermer={() => setEnAttente(null)}
        />
      )}
    </>
  );
}
