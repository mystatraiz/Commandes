import { useMemo, useState } from 'react';
import Graphique from '../components/Graphique.jsx';
import { construireSeries, moyenneMobile, normaliser, bilanPoids } from '../lib/series.js';
import { formatDateCourte, formatHeures } from '../lib/temps.js';

const PERIODES = [7, 14, 30, 90];

const DEFS = [
  { id: 'poids', nom: 'Poids', unite: 'kg', couleur: 'var(--serie-poids)', format: (v) => `${v.toLocaleString('fr-FR')} kg` },
  { id: 'activite', nom: 'Activité', unite: 'kcal', couleur: 'var(--serie-activite)', format: (v) => `${v.toLocaleString('fr-FR')} kcal` },
  { id: 'jeune', nom: 'Jeûne', unite: 'h', couleur: 'var(--serie-jeune)', format: (v) => formatHeures(v) },
];

/*
  Trois grandeurs qui n'ont rien à voir (kg, kcal, heures). Deux lectures :
  - Panneaux : un graphique par grandeur, axes alignés, curseur partagé.
  - Superposées : chaque courbe ramenée sur sa propre plage (0 % = son
    minimum, 100 % = son maximum sur la période). C'est ce qui permet de voir
    si le poids décroche quand l'activité et le jeûne montent — sans le piège
    du double axe. La bulle affiche toujours les vraies valeurs.
*/
export default function Courbes({ entrees, maintenant, onOuvrirPoids }) {
  const [nbJours, setNbJours] = useState(30);
  const [mode, setMode] = useState('panneaux');
  const [actives, setActives] = useState({ poids: true, activite: true, jeune: true });
  const [survol, setSurvol] = useState(null);

  const s = useMemo(() => construireSeries(entrees, nbJours, maintenant), [entrees, nbJours, maintenant]);
  const tendance = useMemo(() => moyenneMobile(s.poids, 7), [s]);
  const bilan = bilanPoids(entrees, maintenant);
  const moyJeune = s.jeune.reduce((a, b) => a + b, 0) / nbJours;
  const kcal = s.activite.reduce((a, b) => a + b, 0);
  const nbSessions = s.sessions.reduce((a, b) => a + b, 0);
  const poidsPeriode = s.poids.filter((v) => v !== null);
  const deltaPeriode = poidsPeriode.length >= 2 ? Math.round((poidsPeriode[poidsPeriode.length - 1] - poidsPeriode[0]) * 10) / 10 : null;

  const visibles = DEFS.filter((d) => actives[d.id]);
  const basculer = (id) => setActives((a) => ({ ...a, [id]: !a[id] }));

  const seriesIndexees = visibles.map((d) => {
    const { valeurs, min, max } = normaliser(s[d.id]);
    return { ...d, valeurs, brut: s[d.id], min, max };
  });

  return (
    <div className="ecran">
      <header className="topbar">
        <div className="titre"><h1>Courbes</h1><span className="sous">Poids, activité et jeûne, jour par jour</span></div>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onOuvrirPoids}>+ Poids</button>
      </header>
      <div className="contenu avec-nav">
        <div className="segment" role="tablist" aria-label="Période">
          {PERIODES.map((p) => <button key={p} type="button" role="tab" aria-selected={nbJours === p} className={nbJours === p ? 'on' : ''} onClick={() => setNbJours(p)}>{p} j</button>)}
        </div>

        <div className="tuiles">
          <div className="tuile"><div className="k">Poids sur {nbJours} j</div><div className={`v ${deltaPeriode < 0 ? 'delta-bas' : deltaPeriode > 0 ? 'delta-haut' : ''}`}>{deltaPeriode === null ? '—' : `${deltaPeriode > 0 ? '+' : ''}${deltaPeriode.toLocaleString('fr-FR')}`}<small>kg</small></div><div className="d">{bilan ? `dernier : ${bilan.dernier.toLocaleString('fr-FR')} kg` : 'aucune pesée'}</div></div>
          <div className="tuile"><div className="k">Jeûne moyen</div><div className="v">{(Math.round(moyJeune * 10) / 10).toLocaleString('fr-FR')}<small>h/j</small></div><div className="d">sur {nbJours} jours</div></div>
          <div className="tuile"><div className="k">Brûlées</div><div className="v">{kcal.toLocaleString('fr-FR')}<small>kcal</small></div><div className="d">{nbSessions} session{nbSessions > 1 ? 's' : ''}</div></div>
          <div className="tuile"><div className="k">Par session</div><div className="v">{nbSessions ? Math.round(kcal / nbSessions).toLocaleString('fr-FR') : '—'}<small>kcal</small></div><div className="d">en moyenne</div></div>
        </div>

        <div className="puces" aria-label="Séries affichées">
          {DEFS.map((d) => (
            <button key={d.id} type="button" className={`puce${actives[d.id] ? ` on ${d.id}` : ''}`} aria-pressed={actives[d.id]} onClick={() => basculer(d.id)}>
              <i className="pastille" style={{ background: actives[d.id] ? 'rgba(255,255,255,.85)' : d.couleur }} />{d.nom} <small>{d.unite}</small>
            </button>
          ))}
        </div>

        <div className="segment" role="tablist" aria-label="Mode d’affichage">
          {[['panneaux', 'Panneaux'], ['superpose', 'Superposées'], ['tableau', 'Tableau']].map(([id, l]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} className={mode === id ? 'on' : ''} onClick={() => setMode(id)}>{l}</button>
          ))}
        </div>

        {visibles.length === 0 && <p className="aide centre-texte">Active au moins une série.</p>}

        {mode === 'panneaux' && visibles.map((d) => (
          <section className="carte" key={d.id}>
            <div className="panneau-titre"><i className="cle" style={{ background: d.couleur }} /><span className="n">{d.nom}</span><span className="u">{d.unite}{d.id === 'poids' ? ' · trait clair : moyenne 7 j' : ''}</span></div>
            {d.id === 'poids' && poidsPeriode.length === 0 ? (
              <p className="aide">Aucune pesée sur la période.</p>
            ) : (
              <Graphique
                jours={s.jours} hauteur={140} zero={d.id !== 'poids'}
                series={[{ id: d.id, nom: d.nom, couleur: d.couleur, valeurs: s[d.id], format: d.format }]}
                tendance={d.id === 'poids' ? tendance : undefined}
                survol={survol} onSurvol={setSurvol}
                formatAxe={d.id === 'jeune' ? (v) => `${Math.round(v)} h` : undefined}
              />
            )}
          </section>
        ))}

        {mode === 'superpose' && visibles.length > 0 && (
          <section className="carte">
            <div className="panneau-titre"><span className="n">Superposition indexée</span><span className="u">0 % = minimum de la période, 100 % = maximum</span></div>
            <Graphique jours={s.jours} hauteur={210} indexe series={seriesIndexees} survol={survol} onSurvol={setSurvol} />
            <div className="legende" style={{ marginTop: 8 }}>
              {seriesIndexees.map((d) => (
                <span key={d.id}><i style={{ background: d.couleur }} />{d.nom} · {d.format(d.min)} → {d.format(d.max)}</span>
              ))}
            </div>
          </section>
        )}

        {mode === 'tableau' && (
          <section className="carte defiler">
            <table className="data">
              <thead><tr><th>Jour</th>{actives.poids && <th>Poids</th>}{actives.activite && <th>kcal</th>}{actives.activite && <th>min</th>}{actives.jeune && <th>Jeûne</th>}</tr></thead>
              <tbody>
                {s.jours.map((j, i) => (
                  <tr key={j}>
                    <td>{formatDateCourte(j)}</td>
                    {actives.poids && <td>{s.poids[i] === null ? '—' : s.poids[i].toLocaleString('fr-FR')}</td>}
                    {actives.activite && <td>{s.activite[i] || '—'}</td>}
                    {actives.activite && <td>{s.minutes[i] || '—'}</td>}
                    {actives.jeune && <td>{s.jeune[i] ? s.jeune[i].toLocaleString('fr-FR') : '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
