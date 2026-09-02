import { useMemo, useState } from 'react';
import { CIRCUITS, DUREES, adapterCircuit } from '../lib/circuits.js';
import { formatCourt } from '../lib/temps.js';

/** Choix d'un circuit et du temps disponible ; le plan s'adapte tout seul. */
export default function Renfo({ onLancer, onRetour }) {
  const [circuitId, setCircuitId] = useState(CIRCUITS[0].id);
  const [minutes, setMinutes] = useState(15);
  const circuit = CIRCUITS.find((c) => c.id === circuitId);
  const plan = useMemo(() => adapterCircuit(circuit, minutes), [circuit, minutes]);

  return (
    <div className="ecran">
      <header className="topbar">
        <button className="btn btn-ghost btn-icon" type="button" onClick={onRetour} aria-label="Retour">←</button>
        <div className="titre"><h1>Renfo</h1><span className="sous">Dis combien de temps tu as, le circuit s’adapte</span></div>
      </header>
      <div className="contenu">
        <section className="carte hero feu">
          <div className="rayures" />
          <div className="carte-tete"><span className="eyebrow feu">Temps disponible</span><span className="chiffre md tabular">{minutes}<small>min</small></span></div>
          <div className="puces" style={{ marginBottom: 8 }}>
            {DUREES.map((m) => (
              <button key={m} type="button" className={`puce${minutes === m ? ' on feu' : ''}`} onClick={() => setMinutes(m)}>{m} min</button>
            ))}
          </div>
          <input className="curseur" type="range" min="5" max="60" step="1" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Temps disponible en minutes" />
        </section>

        <div className="circuits" role="radiogroup" aria-label="Circuit">
          {CIRCUITS.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={c.id === circuitId} className={`circuit ${c.teinte}${c.id === circuitId ? ' on' : ''}`} onClick={() => setCircuitId(c.id)}>
              <div className="txt">
                <div className="n">{c.nom}</div>
                <div className="a">{c.accroche}</div>
                <div className="c">{c.cible} · {c.exercices.length} exercices</div>
              </div>
              <div className="difficulte" aria-label={`Difficulté ${c.difficulte} sur 3`}>{[1, 2, 3].map((n) => <i key={n} className={n <= c.difficulte ? 'on' : ''} />)}</div>
            </button>
          ))}
        </div>

        <section className="carte plan">
          <div className="carte-tete"><span className="eyebrow">Ton plan · {circuit.nom}</span></div>
          <div className="resume">
            <div className="tuile"><div className="k">Tours</div><div className="v">{plan.tours}</div></div>
            <div className="tuile"><div className="k">Exercices</div><div className="v">{plan.exercices.length}</div></div>
            <div className="tuile"><div className="k">Travail / repos</div><div className="v">{plan.travailS}<small>/ {plan.reposS} s</small></div></div>
            <div className="tuile"><div className="k">Total</div><div className="v">{formatCourt(plan.dureeS)}</div></div>
          </div>
          <ol>
            {plan.exercices.map((ex) => <li key={ex.id}>{ex.nom}<span className="z">{ex.zone}</span></li>)}
          </ol>
          {plan.exercices.length < circuit.exercices.length && (
            <p className="aide">{circuit.exercices.length - plan.exercices.length} exercice{circuit.exercices.length - plan.exercices.length > 1 ? 's' : ''} laissé{circuit.exercices.length - plan.exercices.length > 1 ? 's' : ''} de côté faute de temps. Donne-toi plus de minutes pour les récupérer.</p>
          )}
        </section>

        <button className="btn btn-feu btn-lg btn-block" type="button" onClick={() => onLancer(plan)}>Lancer · {formatCourt(plan.dureeS)}</button>
      </div>
    </div>
  );
}
