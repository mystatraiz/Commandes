import { useState } from 'react';
import Feuille from '../components/Feuille.jsx';
import { pesees, bilanPoids } from '../lib/series.js';
import { cleJour, formatDateCourte } from '../lib/temps.js';

const arrondir = (x) => Math.round(x * 10) / 10;

export default function Poids({ entrees, reglages, maintenant, onEnregistrer, onSupprimer, onRetour }) {
  const liste = pesees(entrees).slice().reverse();
  const bilan = bilanPoids(entrees, maintenant);
  const [kg, setKg] = useState(bilan ? String(bilan.dernier) : '');
  const [jour, setJour] = useState(cleJour(maintenant));
  const [selection, setSelection] = useState(null);
  const valeur = Number(String(kg).replace(',', '.'));
  const valide = Number.isFinite(valeur) && valeur > 20 && valeur < 400 && jour <= cleJour(Date.now());
  const objectif = Number(reglages.objectifPoids) || null;

  const bouger = (d) => setKg(String(arrondir((Number(String(kg).replace(',', '.')) || bilan?.dernier || 80) + d)));
  const valider = (e) => {
    e.preventDefault();
    if (!valide) return;
    onEnregistrer(arrondir(valeur), jour);
  };

  return (
    <div className="ecran">
      <header className="topbar">
        <button className="btn btn-ghost btn-icon" type="button" onClick={onRetour} aria-label="Retour">←</button>
        <div className="titre"><h1>Poids</h1><span className="sous">{bilan ? `${bilan.nb} pesée${bilan.nb > 1 ? 's' : ''} · ${bilan.ecartTotal > 0 ? '+' : ''}${bilan.ecartTotal} kg depuis le début` : 'Première pesée'}</span></div>
      </header>
      <div className="contenu">
        <form className="carte hero acier" onSubmit={valider}>
          <div className="carte-tete"><span className="eyebrow acier">Nouvelle pesée</span></div>
          <div className="stepper">
            <button className="btn btn-ghost" type="button" onClick={() => bouger(-0.1)} aria-label="Moins 0,1 kg">−</button>
            <input className="champ grand" inputMode="decimal" placeholder="80,0" value={kg} onChange={(e) => setKg(e.target.value)} aria-label="Poids en kilos" autoFocus />
            <button className="btn btn-ghost" type="button" onClick={() => bouger(0.1)} aria-label="Plus 0,1 kg">+</button>
          </div>
          <div className="rangee" style={{ marginTop: 10 }}>
            <input className="champ" type="date" value={jour} max={cleJour(Date.now())} onChange={(e) => setJour(e.target.value)} aria-label="Date" />
            <button className="btn btn-primary" type="submit" disabled={!valide}>Enregistrer</button>
          </div>
        </form>

        <div className="tuiles trois">
          <div className="tuile"><div className="k">Dernier</div><div className="v">{bilan ? bilan.dernier.toLocaleString('fr-FR') : '—'}<small>kg</small></div></div>
          <div className="tuile"><div className="k">Objectif</div><div className="v">{objectif ? objectif.toLocaleString('fr-FR') : '—'}<small>kg</small></div></div>
          <div className="tuile">
            <div className="k">Reste</div>
            <div className={`v ${bilan && objectif && bilan.dernier <= objectif ? 'delta-bas' : ''}`}>{bilan && objectif ? arrondir(Math.max(0, bilan.dernier - objectif)).toLocaleString('fr-FR') : '—'}<small>kg</small></div>
          </div>
        </div>
        {!objectif && <p className="aide">Fixe un objectif de poids dans Profil pour voir le chemin restant.</p>}

        {liste.length === 0 ? (
          <div className="vide"><div className="big">⚖️</div><h3>Aucune pesée</h3><p>Pèse-toi le matin, à jeun, après être passé aux toilettes. Toujours pareil.</p></div>
        ) : (
          <div className="liste">
            {liste.map((p, i) => {
              const prec = liste[i + 1];
              const delta = prec ? arrondir(p.donnees.kg - prec.donnees.kg) : null;
              return (
                <button className="ligne" type="button" key={p.id} onClick={() => setSelection(p)}>
                  <div className="txt"><div className="t">{formatDateCourte(p.jour)}</div>{p.donnees.note && <div className="d">{p.donnees.note}</div>}</div>
                  <div className="v tabular">{p.donnees.kg.toLocaleString('fr-FR')} kg
                    {delta !== null && <small className={delta < 0 ? 'delta-bas' : delta > 0 ? 'delta-haut' : ''}>{delta > 0 ? '+' : ''}{delta.toLocaleString('fr-FR')} kg</small>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selection && (
        <Feuille titre={formatDateCourte(selection.jour)} onFermer={() => setSelection(null)}>
          <p className="soft"><b>{selection.donnees.kg.toLocaleString('fr-FR')} kg</b></p>
          <button className="btn btn-danger btn-block" type="button" onClick={() => { onSupprimer(selection.id); setSelection(null); }}>Supprimer cette pesée</button>
        </Feuille>
      )}
    </div>
  );
}
