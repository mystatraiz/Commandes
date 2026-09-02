import { useState } from 'react';
import { connecter } from '../supabase.js';

/** Demandé une seule fois par appareil : la session est ensuite mémorisée. */
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
        <img src="/icon.svg" alt="" className="logo" />
        <h1>Forge</h1>
        <p>Entre ton code d’accès pour retrouver tes données. Il n’est demandé qu’une fois sur cet appareil.</p>
        <input
          className="champ" type="password" inputMode="text" autoComplete="current-password"
          placeholder="Code d’accès" value={code} onChange={(e) => setCode(e.target.value)}
          disabled={enCours} aria-label="Code d’accès" aria-invalid={Boolean(erreur)} autoFocus
        />
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={!code.trim() || enCours}>
          {enCours ? 'Connexion…' : 'Entrer'}
        </button>
      </form>
    </div>
  );
}
