import { useState } from 'react';
import { cleJour, versInputDateHeure } from '../lib/temps.js';

const DUREES_PADEL = [60, 90, 120];
const DUREES_AUTRE = [30, 45, 60];

/** Saisie d'une session de padel (ou d'un autre sport) : la montre donne les calories, toi le reste. */
export default function FormSession({ entree, sport = 'padel', onEnregistrer, onRetour }) {
  const d = entree?.donnees || {};
  const typeSport = entree ? d.sport : sport;
  const padel = typeSport === 'padel';
  const [debut, setDebut] = useState(versInputDateHeure(entree?.debut || Date.now() - 90 * 60000));
  const [nom, setNom] = useState(d.nom || '');
  const [duree, setDuree] = useState(d.dureeMin ? String(d.dureeMin) : padel ? '90' : '45');
  const [calories, setCalories] = useState(d.calories ? String(d.calories) : '');
  const [intensite, setIntensite] = useState(d.intensite || 3);
  const [resultat, setResultat] = useState(d.resultat || null);
  const [note, setNote] = useState(d.note || '');

  const dureeMin = Math.round(Number(duree));
  const kcal = Math.round(Number(String(calories).replace(',', '.')));
  const debutMs = new Date(debut).getTime();
  const valide = Number.isFinite(debutMs) && debutMs <= Date.now() + 60000 && dureeMin > 0 && dureeMin < 600
    && (calories === '' || (Number.isFinite(kcal) && kcal >= 0 && kcal < 5000)) && (padel || nom.trim());

  const valider = (e) => {
    e.preventDefault();
    if (!valide) return;
    onEnregistrer({
      ...(entree || {}),
      type: 'sport',
      jour: cleJour(debutMs),
      debut: debutMs,
      fin: debutMs + dureeMin * 60000,
      donnees: {
        ...d,
        sport: typeSport,
        nom: padel ? undefined : nom.trim(),
        dureeMin,
        calories: calories === '' ? 0 : kcal,
        intensite,
        resultat: padel ? resultat : undefined,
        note: note.trim() || undefined,
      },
    });
  };

  return (
    <div className="ecran">
      <header className="topbar">
        <button className="btn btn-ghost btn-icon" type="button" onClick={onRetour} aria-label="Retour">←</button>
        <div className="titre"><h1>{entree ? 'Modifier' : padel ? 'Session padel' : 'Autre sport'}</h1><span className="sous">{padel ? 'Les calories, c’est ta montre qui les donne' : 'Course, vélo, natation… ce que tu veux'}</span></div>
      </header>
      <form className="contenu" onSubmit={valider}>
        {!padel && (
          <div className="champ-groupe">
            <label htmlFor="nom-sport">Sport</label>
            <input id="nom-sport" className="champ" placeholder="Course à pied, vélo…" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
          </div>
        )}
        <div className="champ-groupe">
          <label htmlFor="debut">Début</label>
          <input id="debut" className="champ" type="datetime-local" value={debut} max={versInputDateHeure(Date.now())} onChange={(e) => setDebut(e.target.value)} />
        </div>
        <div className="champ-groupe">
          <label htmlFor="duree">Durée (min)</label>
          <div className="puces">
            {(padel ? DUREES_PADEL : DUREES_AUTRE).map((m) => (
              <button key={m} type="button" className={`puce${dureeMin === m ? ' on' : ''}`} onClick={() => setDuree(String(m))}>{m} min</button>
            ))}
          </div>
          <input id="duree" className="champ" inputMode="numeric" value={duree} onChange={(e) => setDuree(e.target.value)} aria-label="Durée en minutes" />
        </div>
        <div className="champ-groupe">
          <label htmlFor="calories">Calories (montre)</label>
          <input id="calories" className="champ grand" inputMode="numeric" placeholder="0" value={calories} onChange={(e) => setCalories(e.target.value)} />
          <span className="aide">Ce qu’affiche ta montre à la fin de la session. Laisse vide si tu ne l’as pas.</span>
        </div>
        <div className="champ-groupe">
          <label>Intensité</label>
          <div className="intensite" role="radiogroup" aria-label="Intensité">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={intensite === n} className={intensite === n ? 'on' : ''} onClick={() => setIntensite(n)}>{n}</button>
            ))}
          </div>
        </div>
        {padel && (
          <div className="champ-groupe">
            <label>Résultat</label>
            <div className="puces">
              {[['victoire', 'Victoire'], ['defaite', 'Défaite'], [null, 'Entraînement']].map(([v, l]) => (
                <button key={l} type="button" className={`puce${resultat === v ? ' on' : ''}${v === 'defaite' && resultat === v ? ' feu' : ''}`} onClick={() => setResultat(v)}>{l}</button>
              ))}
            </div>
          </div>
        )}
        <div className="champ-groupe">
          <label htmlFor="note">Note</label>
          <textarea id="note" className="champ" placeholder="Partenaires, score, sensations…" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={!valide}>{entree ? 'Enregistrer' : 'Valider la session'}</button>
      </form>
    </div>
  );
}
