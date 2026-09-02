import { useState } from 'react';
import Feuille from '../components/Feuille.jsx';
import { sessions } from '../lib/series.js';
import { xpSession } from '../lib/gamification.js';
import { formatDateCourte, formatHeure, cleJour } from '../lib/temps.js';

export const SPORTS = {
  padel:        { nom: 'Padel',        icone: '🎾' },
  renfo:        { nom: 'Renfo',        icone: '💪' },
  echauffement: { nom: 'Échauffement', icone: '🌡️' },
  autre:        { nom: 'Autre',        icone: '🏃' },
};

export function libelleSession(s) {
  const d = s.donnees || {};
  if (d.sport === 'autre' && d.nom) return d.nom;
  if (d.sport === 'renfo' && d.circuit?.nom) return d.circuit.nom;
  return SPORTS[d.sport]?.nom || 'Session';
}

export default function Sport({ entrees, resume, maintenant, onOuvrir, onSupprimer }) {
  const liste = sessions(entrees);
  const [selection, setSelection] = useState(null);
  const { semaine } = resume;
  const auj = cleJour(maintenant);

  const groupes = [];
  for (const s of liste) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.jour === s.jour) dernier.items.push(s);
    else groupes.push({ jour: s.jour, items: [s] });
  }

  return (
    <div className="ecran">
      <header className="topbar">
        <div className="titre"><h1>Sport</h1><span className="sous">{semaine.sessions} session{semaine.sessions > 1 ? 's' : ''} cette semaine · {semaine.kcal.toLocaleString('fr-FR')} kcal</span></div>
      </header>
      <div className="contenu avec-nav">
        <div className="actions">
          <button className="action lime" type="button" onClick={() => onOuvrir('session', { sport: 'padel' })}><span className="ico">🎾</span>Padel</button>
          <button className="action feu" type="button" onClick={() => onOuvrir('renfo')}><span className="ico">💪</span>Renfo</button>
          <button className="action acier" type="button" onClick={() => onOuvrir('echauffement')}><span className="ico">🌡️</span>Échauff.</button>
          <button className="action" type="button" onClick={() => onOuvrir('session', { sport: 'autre' })}><span className="ico">🏃</span>Autre</button>
        </div>

        <div className="tuiles trois">
          <div className="tuile"><div className="k">Semaine</div><div className="v">{semaine.sessions}<small>/ {semaine.objectif}</small></div><div className="d">sessions</div></div>
          <div className="tuile"><div className="k">Brûlées</div><div className="v">{semaine.kcal.toLocaleString('fr-FR')}<small>kcal</small></div><div className="d">cette semaine</div></div>
          <div className="tuile"><div className="k">Temps</div><div className="v">{semaine.minutes}<small>min</small></div><div className="d">cette semaine</div></div>
        </div>

        {liste.length === 0 ? (
          <div className="vide"><div className="big">🎾</div><h3>Aucune session</h3><p>Enregistre ta prochaine session de padel avec les calories de ta montre, ou lance un circuit de renfo.</p></div>
        ) : groupes.map((g) => (
          <section key={g.jour}>
            <div className="jour-titre">{g.jour === auj ? 'Aujourd’hui' : formatDateCourte(g.jour)}</div>
            <div className="liste" style={{ marginTop: 8 }}>
              {g.items.map((s) => {
                const d = s.donnees || {};
                return (
                  <button className="ligne" type="button" key={s.id} onClick={() => setSelection(s)}>
                    <div className={`ico ${d.sport || 'autre'}`}>{SPORTS[d.sport]?.icone || '🏃'}</div>
                    <div className="txt">
                      <div className="t">{libelleSession(s)}{d.resultat === 'victoire' ? ' · Victoire' : d.resultat === 'defaite' ? ' · Défaite' : ''}</div>
                      <div className="d">{s.debut ? formatHeure(s.debut) : ''}{d.dureeMin ? ` · ${d.dureeMin} min` : ''}{d.intensite ? ` · intensité ${d.intensite}/5` : ''}{d.note ? ` · ${d.note}` : ''}</div>
                    </div>
                    <div className="v tabular">{d.calories ? d.calories.toLocaleString('fr-FR') : '—'}<small>kcal · +{xpSession(s)} XP</small></div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {selection && (
        <Feuille titre={libelleSession(selection)} onFermer={() => setSelection(null)}>
          <p className="soft">
            {formatDateCourte(selection.jour)}{selection.debut ? ` à ${formatHeure(selection.debut)}` : ''}
            {selection.donnees?.dureeMin ? ` · ${selection.donnees.dureeMin} min` : ''}
            {selection.donnees?.calories ? ` · ${selection.donnees.calories} kcal` : ''}
          </p>
          {selection.donnees?.circuit && (
            <p className="aide">{selection.donnees.circuit.tours} tour{selection.donnees.circuit.tours > 1 ? 's' : ''} · {selection.donnees.circuit.exercices?.join(', ')}</p>
          )}
          {['padel', 'autre'].includes(selection.donnees?.sport) && (
            <button className="btn btn-ghost btn-block" type="button" onClick={() => { onOuvrir('session', { entree: selection }); setSelection(null); }}>Modifier</button>
          )}
          <button className="btn btn-danger btn-block" type="button" onClick={() => { onSupprimer(selection.id); setSelection(null); }}>Supprimer</button>
        </Feuille>
      )}
    </div>
  );
}
