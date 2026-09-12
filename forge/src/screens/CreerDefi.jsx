import { useState } from 'react';
import { MESURES, VISIBILITES, DUREES_DEFI, finPour } from '../lib/defis.js';
import { cleJour, formatDateCourte } from '../lib/temps.js';
import { EMOJIS } from './Connexion.jsx';

export default function CreerDefi({ profil, maintenant, onCreer, onRetour }) {
  const [nom, setNom] = useState('');
  const [mesure, setMesure] = useState('pourcentage');
  const [debut, setDebut] = useState(cleJour(maintenant));
  const [jours, setJours] = useState(28);
  const [gage, setGage] = useState('');
  const [pseudo, setPseudo] = useState(profil?.pseudo || '');
  const [emoji, setEmoji] = useState(profil?.emoji || '💪');
  const [visibilite, setVisibilite] = useState('pourcentage');
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const fin = finPour(debut, jours);
  const valide = nom.trim().length >= 2 && pseudo.trim().length >= 2 && jours >= 3;

  const valider = async (e) => {
    e.preventDefault();
    if (!valide || enCours) return;
    setEnCours(true);
    setErreur(null);
    const r = await onCreer({ nom, mesure, debut, fin, gage, pseudo, emoji, visibilite });
    setEnCours(false);
    if (!r.ok) setErreur(r.message);
  };

  return (
    <div className="ecran">
      <header className="topbar">
        <button className="btn btn-ghost btn-icon" type="button" onClick={onRetour} aria-label="Retour">←</button>
        <div className="titre"><h1>Créer un défi</h1><span className="sous">Tu recevras un code à distribuer</span></div>
      </header>

      <form className="contenu" onSubmit={valider}>
        <div className="champ-groupe">
          <label htmlFor="nom-defi">Nom du défi</label>
          <input id="nom-defi" className="champ" placeholder="La Chasse au Gras" value={nom} maxLength={60}
            onChange={(e) => setNom(e.target.value)} autoFocus />
        </div>

        <div className="champ-groupe">
          <label>Ce qu’on compare</label>
          <div className="puces" role="radiogroup" aria-label="Mesure">
            {MESURES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={mesure === m.id}
                className={`puce${mesure === m.id ? ' on' : ''}`} onClick={() => setMesure(m.id)}>
                {m.nom}
              </button>
            ))}
          </div>
          <span className="aide">{MESURES.find((m) => m.id === mesure).detail}</span>
        </div>

        <div className="champ-groupe">
          <label htmlFor="debut-defi">Départ</label>
          <input id="debut-defi" className="champ" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </div>

        <div className="champ-groupe">
          <label>Durée</label>
          <div className="puces" role="radiogroup" aria-label="Durée">
            {DUREES_DEFI.map((d) => (
              <button key={d.jours} type="button" role="radio" aria-checked={jours === d.jours}
                className={`puce${jours === d.jours ? ' on' : ''}`} onClick={() => setJours(d.jours)}>
                {d.nom}
              </button>
            ))}
          </div>
          <span className="aide">Dernier jour compris : {formatDateCourte(fin)}.</span>
        </div>

        <div className="champ-groupe">
          <label htmlFor="gage-defi">Gage du dernier</label>
          <input id="gage-defi" className="champ" placeholder="Le dernier paie la tournée" value={gage} maxLength={140}
            onChange={(e) => setGage(e.target.value)} />
          <span className="aide">
            Une phrase, affichée sur le palmarès. L’application ne gère aucun argent.
          </span>
        </div>

        <div className="sep" />

        <div className="champ-groupe">
          <label htmlFor="pseudo-defi">Ton pseudo dans ce défi</label>
          <input id="pseudo-defi" className="champ" value={pseudo} maxLength={24} onChange={(e) => setPseudo(e.target.value)} />
          <div className="emojis" role="radiogroup" aria-label="Ton emblème">
            {EMOJIS.map((x) => (
              <button key={x} type="button" role="radio" aria-checked={emoji === x}
                className={`emoji${emoji === x ? ' on' : ''}`} onClick={() => setEmoji(x)}>{x}</button>
            ))}
          </div>
        </div>

        <div className="champ-groupe">
          <label>Ce que les autres voient de toi</label>
          <div className="puces" role="radiogroup" aria-label="Visibilité">
            {VISIBILITES.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={visibilite === v.id}
                className={`puce${visibilite === v.id ? ' on acier' : ''}`} onClick={() => setVisibilite(v.id)}>
                {v.nom}
              </button>
            ))}
          </div>
          <span className="aide">
            {VISIBILITES.find((v) => v.id === visibilite).detail} Ton poids, lui, ne sort jamais.
          </span>
        </div>

        {erreur && <p className="erreur" role="alert">{erreur}</p>}

        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={!valide || enCours}>
          {enCours ? 'Création…' : 'Lancer le défi'}
        </button>
      </form>
    </div>
  );
}
