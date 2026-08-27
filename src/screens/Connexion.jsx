import { useState } from 'react';
import { connecter } from '../supabase.js';

/** Demandé une seule fois par téléphone : la session est ensuite mémorisée. */
export default function Connexion({ onConnecte }) {
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const valider = async (e) => {
    e.preventDefault();
    if (!code.trim() || enCours) return;
    setEnCours(true);
    setErreur(null);
    const r = await connecter(code.trim());
    setEnCours(false);
    if (r.ok) onConnecte();
    else { setErreur(r.message); setCode(''); }
  };

  return (
    <div className="connexion">
      <form className="connexion-carte" onSubmit={valider}>
        <img src="/icon.svg" alt="" width="64" height="64" className="connexion-logo" />
        <h1>Commandes du grill</h1>
        <p className="lede">
          Entrez le code du restaurant pour rejoindre les commandes partagées.
          Il n’est demandé qu’une fois sur ce téléphone.
        </p>

        <input
          className="champ"
          type="password"
          inputMode="text"
          autoComplete="current-password"
          placeholder="Code d’accès"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={enCours}
          aria-label="Code d’accès du restaurant"
          aria-invalid={Boolean(erreur)}
          autoFocus
        />

        {erreur && <p className="erreur" role="alert">{erreur}</p>}

        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={!code.trim() || enCours}>
          {enCours ? 'Connexion…' : 'Rejoindre'}
        </button>
      </form>
    </div>
  );
}
