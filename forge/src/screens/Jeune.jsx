import { useState } from 'react';
import Anneau from '../components/Anneau.jsx';
import Feuille from '../components/Feuille.jsx';
import { OBJECTIFS_JEUNE, PHASES, jeuneEnCours, jeunesTermines, dureeJeuneMs, dureeJeuneH, phaseCourante } from '../lib/jeune.js';
import { construireSeries } from '../lib/series.js';
import { formatChrono, formatDuree, formatHeures, formatDateCourte, formatHeure, versInputDateHeure, cleJour } from '../lib/temps.js';

export default function Jeune({ entrees, reglages, maintenant, onDemarrer, onTerminer, onModifier, onSupprimer }) {
  const jeune = jeuneEnCours(entrees);
  const [objectif, setObjectif] = useState(Number(reglages.objectifJeuneH) || 16);
  const [feuille, setFeuille] = useState(null);   // 'debut' | 'autre-heure' | { jeune }
  const [heure, setHeure] = useState('');

  const objectifCourant = jeune ? (Number(jeune.donnees?.objectifH) || objectif) : objectif;
  const ecoule = jeune ? dureeJeuneMs(jeune, maintenant) : 0;
  const heures = ecoule / 3600000;
  const phase = phaseCourante(heures);
  const historique = jeunesTermines(entrees);
  const s7 = construireSeries(entrees, 7, maintenant);
  const moy7 = s7.jeune.reduce((a, b) => a + b, 0) / 7;
  const meilleur = historique.reduce((m, j) => Math.max(m, dureeJeuneH(j, maintenant)), 0);
  const reussis = historique.filter((j) => dureeJeuneH(j) >= (Number(j.donnees?.objectifH) || 16)).length;

  const ouvrirHeure = (mode) => {
    setHeure(versInputDateHeure(mode === 'debut' && jeune ? jeune.debut : maintenant - 3600000));
    setFeuille(mode);
  };
  const validerHeure = () => {
    const ms = new Date(heure).getTime();
    if (!Number.isFinite(ms) || ms > Date.now()) return;
    if (feuille === 'debut' && jeune) onModifier(jeune, { debut: ms, jour: cleJour(ms) });
    else onDemarrer(objectif, ms);
    setFeuille(null);
  };

  return (
    <div className="ecran">
      <header className="topbar">
        <div className="titre"><h1>Jeûne</h1><span className="sous">{jeune ? `Démarré ${formatDateCourte(cleJour(jeune.debut))} à ${formatHeure(jeune.debut)}` : 'Choisis ton objectif et lance-toi'}</span></div>
      </header>
      <div className="contenu avec-nav">
        <section className={`carte hero${jeune ? '' : ' acier'}`}>
          <div className="rayures" />
          <div className="jeune-hero">
            <Anneau valeur={jeune ? heures / objectifCourant : 0} taille={228} epaisseur={16} couleur={heures >= objectifCourant ? 'var(--ok)' : 'var(--lime)'}>
              {jeune ? (
                <>
                  <div className="chrono tabular">{formatChrono(ecoule)}</div>
                  <div className="objectif">{Math.min(100, Math.round((heures / objectifCourant) * 100))} % de {objectifCourant} h</div>
                </>
              ) : (
                <>
                  <div className="chiffre lg">{objectif}<small>h</small></div>
                  <div className="objectif">{OBJECTIFS_JEUNE.find((o) => o.h === objectif)?.nom || 'perso'}</div>
                </>
              )}
            </Anneau>
            {jeune ? (
              <>
                <div>
                  <div className="phase">{phase.nom}</div>
                  <div className="detail">{phase.detail}</div>
                  {phase.suivante && <div className="objectif" style={{ marginTop: 4 }}>Prochaine phase à {phase.suivante.depuis} h · dans {formatDuree(phase.suivante.depuis * 3600000 - ecoule)}</div>}
                </div>
                <div className="rangee" style={{ width: '100%' }}>
                  <button className="btn btn-ghost" type="button" onClick={() => ouvrirHeure('debut')}>Heure de début</button>
                  <button className="btn btn-feu" type="button" onClick={() => onTerminer(jeune)}>Terminer</button>
                </div>
              </>
            ) : (
              <>
                <div className="puces" role="radiogroup" aria-label="Objectif">
                  {OBJECTIFS_JEUNE.map((o) => (
                    <button key={o.h} type="button" role="radio" aria-checked={objectif === o.h} className={`puce${objectif === o.h ? ' on' : ''}`} onClick={() => setObjectif(o.h)}>
                      {o.h} h <small>{o.nom}</small>
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary btn-lg btn-block" type="button" onClick={() => onDemarrer(objectif)}>Lancer le jeûne</button>
                <button className="btn btn-quiet btn-sm" type="button" onClick={() => ouvrirHeure('autre-heure')}>J’ai commencé plus tôt…</button>
              </>
            )}
          </div>
        </section>

        <div className="tuiles trois">
          <div className="tuile"><div className="k">Moyenne 7 j</div><div className="v">{(Math.round(moy7 * 10) / 10).toLocaleString('fr-FR')}<small>h</small></div></div>
          <div className="tuile"><div className="k">Record</div><div className="v">{(Math.round(meilleur * 10) / 10).toLocaleString('fr-FR')}<small>h</small></div></div>
          <div className="tuile"><div className="k">Réussis</div><div className="v">{reussis}<small>/ {historique.length}</small></div></div>
        </div>

        <section className="carte">
          <div className="carte-tete"><span className="eyebrow">Ce qui se passe dans ton corps</span></div>
          <div className="phases">
            {PHASES.map((p) => {
              const passee = jeune && heures >= p.depuis && phase.nom !== p.nom;
              const courante = jeune && phase.nom === p.nom;
              return (
                <div className={`phase-ligne${passee ? ' passee' : ''}${courante ? ' courante' : ''}`} key={p.nom}>
                  <div className="h">{p.depuis}h</div>
                  <div><div className="n">{p.nom}{courante ? ' ← toi' : ''}</div><div className="d">{p.detail}</div></div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="carte-tete"><span className="eyebrow">Historique</span></div>
          {historique.length === 0 ? (
            <div className="vide"><div className="big">⏱️</div><h3>Aucun jeûne terminé</h3><p>Ton premier jeûne terminé apparaîtra ici, avec sa durée et son objectif.</p></div>
          ) : (
            <div className="liste">
              {historique.slice(0, 30).map((j) => {
                const h = dureeJeuneH(j);
                const obj = Number(j.donnees?.objectifH) || 16;
                return (
                  <button className="ligne" type="button" key={j.id} onClick={() => setFeuille({ jeune: j })}>
                    <div className="ico">{h >= obj ? '✅' : '⏱️'}</div>
                    <div className="txt"><div className="t">{formatDateCourte(cleJour(j.debut))}</div><div className="d">{formatHeure(j.debut)} → {formatHeure(j.fin)} · objectif {obj} h</div></div>
                    <div className={`v tabular${h >= obj ? ' ok' : ''}`}>{formatHeures(h)}<small>{h >= obj ? 'objectif atteint' : `${Math.round(((h / obj) * 100))} %`}</small></div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {(feuille === 'debut' || feuille === 'autre-heure') && (
        <Feuille titre={feuille === 'debut' ? 'Heure de début' : 'Commencé plus tôt'} onFermer={() => setFeuille(null)}>
          <div className="champ-groupe">
            <label htmlFor="heure-jeune">Dernier repas terminé à</label>
            <input id="heure-jeune" className="champ" type="datetime-local" value={heure} max={versInputDateHeure(Date.now())} onChange={(e) => setHeure(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" type="button" onClick={validerHeure}>{feuille === 'debut' ? 'Corriger' : `Lancer le jeûne ${objectif} h`}</button>
        </Feuille>
      )}

      {feuille?.jeune && (
        <Feuille titre="Ce jeûne" onFermer={() => setFeuille(null)}>
          <p className="soft">{formatDateCourte(cleJour(feuille.jeune.debut))}, {formatHeure(feuille.jeune.debut)} → {formatHeure(feuille.jeune.fin)} : <b>{formatHeures(dureeJeuneH(feuille.jeune))}</b>.</p>
          <button className="btn btn-danger btn-block" type="button" onClick={() => { onSupprimer(feuille.jeune.id); setFeuille(null); }}>Supprimer ce jeûne</button>
        </Feuille>
      )}
    </div>
  );
}
