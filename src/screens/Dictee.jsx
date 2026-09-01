import { useCallback, useEffect, useRef, useState } from 'react';
import { CUISSONS, GRILLADES, cuissonById, grilladeById } from '../config.js';
import { ecouter } from '../lib/micro.js';
import { analyser } from '../lib/vocal.js';

const nomGrillade = (id) => grilladeById(id)?.nom || id;

/* Écran de dictée.

   La commande comprise n'est jamais envoyée directement : elle est affichée
   pour relecture, corrigeable, et c'est un geste explicite qui la valide.
   Au grill il y a du bruit, et une pièce partie sur une cuisson mal entendue
   est une pièce perdue. */
export default function Dictee({ onValider, onRetour }) {
  const [enEcoute, setEnEcoute] = useState(true);
  const [texte, setTexte] = useState('');
  const [resultat, setResultat] = useState(null);
  const [probleme, setProbleme] = useState(null);
  const session = useRef(null);

  const terminer = useCallback((brut) => {
    setEnEcoute(false);
    const t = (brut || '').trim();
    setResultat(t ? analyser(t) : null);
  }, []);

  const demarrer = useCallback(() => {
    setProbleme(null);
    setTexte('');
    setResultat(null);
    setEnEcoute(true);
    let dernier = '';
    session.current = ecouter({
      surTexte: (t) => { dernier = t; setTexte(t); },
      surFin: (raison) => {
        session.current = null;
        if (raison === 'fin') { terminer(dernier); return; }
        setEnEcoute(false);
        setProbleme({
          'micro-refuse': 'L’accès au micro a été refusé. Autorisez-le dans les réglages du navigateur.',
          'micro-absent': 'Aucun micro accessible sur cet appareil.',
          'rien-entendu': 'Rien n’a été entendu.',
          reseau: 'La dictée a besoin du réseau, et il est injoignable. La saisie tactile reste disponible.',
          indisponible: 'La dictée n’est pas disponible sur ce navigateur.',
        }[raison] || 'La dictée s’est interrompue.');
      },
    });
  }, [terminer]);

  useEffect(() => {
    demarrer();
    return () => session.current?.arreter();
  }, [demarrer]);

  const stopper = () => { session.current?.arreter(); session.current = null; terminer(texte); };

  /* ---- Corrections sur le résultat ---- */
  const majLigne = (i, patch) => setResultat((r) => {
    const lignes = r.lignes.slice();
    lignes[i] = { ...lignes[i], ...patch };
    if (patch.cuisson !== undefined) delete lignes[i].incomplete;
    return { ...r, lignes };
  });
  const retirerLigne = (i) => setResultat((r) => ({ ...r, lignes: r.lignes.filter((_, k) => k !== i) }));

  const aCompleter = resultat?.lignes.some((l) => l.incomplete);
  const pretAValider = resultat && resultat.table && resultat.lignes.length > 0 && !aCompleter;

  return (
    <>
      <header className="topbar">
        <button className="btn btn-quiet btn-icon" type="button" onClick={onRetour} aria-label="Annuler">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="title">
          Commande dictée
          <span className="sub">{enEcoute ? 'Parlez, puis appuyez sur Terminer' : 'Relisez avant d’envoyer'}</span>
        </h1>
      </header>

      <div className="content">
        <div className="inner">
          {enEcoute && (
            <div className="ecoute">
              <div className="onde" aria-hidden="true"><span /><span /><span /><span /><span /></div>
              <p className="dit">{texte || 'Par exemple : « table 12, deux côtes saignantes et un poulet »'}</p>
            </div>
          )}

          {probleme && (
            <div className="anomalie" role="alert">
              <strong>Dictée impossible.</strong> {probleme}
            </div>
          )}

          {resultat && (
            <>
              <p className="dit-relu">« {texte} »</p>

              <div className="panel">
                <h2>Table {resultat.table || '—'}</h2>
                {!resultat.table && (
                  <p className="lede">Aucun numéro de table reconnu. Reprenez la dictée ou passez par la saisie.</p>
                )}

                {resultat.lignes.length === 0 ? (
                  <p className="lede">Aucune grillade reconnue.</p>
                ) : (
                  <ul className="relu">
                    {resultat.lignes.map((l, i) => {
                      const c = cuissonById(l.cuisson);
                      const def = grilladeById(l.grillade);
                      return (
                        <li key={i} className={l.incomplete ? 'manque' : ''}>
                          <div className="tete">
                            <span className="qte">
                              <button type="button" onClick={() => majLigne(i, { qte: Math.max(1, l.qte - 1) })} aria-label="Une de moins">−</button>
                              <b>{l.qte}</b>
                              <button type="button" onClick={() => majLigne(i, { qte: Math.min(99, l.qte + 1) })} aria-label="Une de plus">+</button>
                            </span>
                            <span className="nom">{nomGrillade(l.grillade)}</span>
                            <button className="oter" type="button" onClick={() => retirerLigne(i)} aria-label={`Retirer ${nomGrillade(l.grillade)}`}>×</button>
                          </div>
                          {!def?.sansCuisson && (
                            <div className="cuissons-choix">
                              {CUISSONS.map((cu) => (
                                <button
                                  key={cu.id}
                                  type="button"
                                  className={cu.id === l.cuisson ? 'on' : ''}
                                  style={cu.id === l.cuisson ? { background: cu.couleur, color: cu.encre } : undefined}
                                  onClick={() => majLigne(i, { cuisson: cu.id })}
                                >
                                  {cu.nom}
                                </button>
                              ))}
                            </div>
                          )}
                          {def?.sansCuisson && <span className="sans">sans cuisson</span>}
                          {l.incomplete && <span className="alerte">Cuisson non entendue — choisissez-la</span>}
                          {c && !l.incomplete && <span className="sr-only">{c.nom}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {resultat.motsIgnores?.length > 0 && (
                  <p className="ignores">
                    Non repris : {resultat.motsIgnores.join(', ')}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="footer-bar">
        {enEcoute ? (
          <button className="btn btn-primary btn-lg btn-block" type="button" onClick={stopper}>
            Terminer
          </button>
        ) : (
          <>
            <button className="btn btn-ghost btn-lg" type="button" onClick={demarrer}>Recommencer</button>
            <button
              className="btn btn-primary btn-lg"
              style={{ flex: 1 }}
              type="button"
              disabled={!pretAValider}
              onClick={() => onValider(resultat)}
            >
              {aCompleter ? 'Cuisson à choisir' : 'Vers la commande'}
            </button>
          </>
        )}
      </div>
    </>
  );
}
