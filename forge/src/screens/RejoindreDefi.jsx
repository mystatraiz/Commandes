import { useState } from 'react';
import { VISIBILITES, codeValide, normaliserCode, LONGUEUR_CODE, mesureById, joursTotal } from '../lib/defis.js';
import { formatDateCourte } from '../lib/temps.js';
import { EMOJIS } from './Connexion.jsx';

/** Deux temps : on regarde ce que cache le code, puis on s'engage. */
export default function RejoindreDefi({ profil, onApercu, onRejoindre, onRetour }) {
  const [code, setCode] = useState('');
  const [defi, setDefi] = useState(null);
  const [pseudo, setPseudo] = useState(profil?.pseudo || '');
  const [emoji, setEmoji] = useState(profil?.emoji || '💪');
  const [visibilite, setVisibilite] = useState('pourcentage');
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const regarder = async (e) => {
    e.preventDefault();
    if (!codeValide(code) || enCours) return;
    setEnCours(true);
    setErreur(null);
    const r = await onApercu(code);
    setEnCours(false);
    if (r.ok) setDefi(r.defi); else setErreur(r.message);
  };

  const entrer = async () => {
    if (pseudo.trim().length < 2 || enCours) return;
    setEnCours(true);
    setErreur(null);
    const r = await onRejoindre({ code, pseudo, emoji, visibilite });
    setEnCours(false);
    if (!r.ok) setErreur(r.message);
  };

  return (
    <div className="ecran">
      <header className="topbar">
        <button className="btn btn-ghost btn-icon" type="button" onClick={onRetour} aria-label="Retour">←</button>
        <div className="titre"><h1>Rejoindre</h1><span className="sous">Entre le code qu’on t’a envoyé</span></div>
      </header>

      <div className="contenu">
        {!defi ? (
          <form onSubmit={regarder} style={{ display: 'contents' }}>
            <div className="champ-groupe">
              <label htmlFor="code-defi">Code du défi</label>
              <input
                id="code-defi" className="champ code" placeholder="ABC234" value={code}
                inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck="false"
                maxLength={LONGUEUR_CODE + 2} autoFocus
                onChange={(e) => setCode(normaliserCode(e.target.value).slice(0, LONGUEUR_CODE))}
              />
              <span className="aide">Six caractères. Ni I, ni L, ni O, ni zéro, ni un : ils se confondent.</span>
            </div>
            {erreur && <p className="erreur" role="alert">{erreur}</p>}
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={!codeValide(code) || enCours}>
              {enCours ? 'Recherche…' : 'Voir le défi'}
            </button>
          </form>
        ) : (
          <>
            <section className="carte hero">
              <div className="rayures" />
              <div className="carte-tete"><span className="eyebrow">Ce défi</span></div>
              <h2 className="titre-carte">{defi.nom}</h2>
              <div className="tuiles" style={{ marginTop: 12 }}>
                <div className="tuile"><div className="k">Période</div><div className="v" style={{ fontSize: 18 }}>{joursTotal(defi)}<small>jours</small></div><div className="d">jusqu’au {formatDateCourte(defi.fin)}</div></div>
                <div className="tuile"><div className="k">Mesure</div><div className="v" style={{ fontSize: 18 }}>{mesureById(defi.mesure).court}</div><div className="d">{mesureById(defi.mesure).nom}</div></div>
              </div>
              <p className="aide" style={{ marginTop: 10 }}>
                {Number(defi.participants)} inscrit{Number(defi.participants) > 1 ? 's' : ''} pour l’instant.
              </p>
              {defi.gage && <p className="punchline" style={{ marginTop: 10, fontSize: 16 }}>{defi.gage}</p>}
            </section>

            <div className="champ-groupe">
              <label htmlFor="pseudo-rejoindre">Ton pseudo dans ce défi</label>
              <input id="pseudo-rejoindre" className="champ" value={pseudo} maxLength={24}
                onChange={(e) => setPseudo(e.target.value)} />
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

            <button className="btn btn-primary btn-lg btn-block" type="button"
              disabled={pseudo.trim().length < 2 || enCours} onClick={entrer}>
              {enCours ? 'Un instant…' : 'Entrer dans le défi'}
            </button>
            <button className="btn btn-quiet btn-block" type="button" onClick={() => { setDefi(null); setErreur(null); }}>
              Changer de code
            </button>
          </>
        )}
      </div>
    </div>
  );
}
