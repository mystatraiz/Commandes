import { useState } from 'react';
import { connecter, inscrire } from '../supabase.js';

export const EMOJIS = ['💪', '🔥', '🐻', '🦊', '🦍', '🐺', '🦅', '🦈', '🐗', '⚡', '🥊', '🏋️'];

/**
 * Compte personnel : chacun le sien, c'est ce qui permet à plusieurs de courir
 * ensemble. Demandé une fois par appareil, la session est ensuite mémorisée.
 */
export default function Connexion({ onConnecte }) {
  const [mode, setMode] = useState('connexion');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [emoji, setEmoji] = useState('💪');
  const [erreur, setErreur] = useState(null);
  const [info, setInfo] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const inscription = mode === 'inscription';
  const valide = email.trim().includes('@') && mdp.length >= 6 && (!inscription || pseudo.trim().length >= 2);

  const valider = async (e) => {
    e.preventDefault();
    if (!valide || enCours) return;
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    const r = inscription
      ? await inscrire({ email, mdp, pseudo, emoji })
      : await connecter({ email, mdp });
    setEnCours(false);
    if (!r.ok) { setErreur(r.message); return; }
    // Projet réglé sur la confirmation d'adresse : rien ne sert d'entrer, il
    // faut d'abord cliquer le lien reçu.
    if (r.confirmationRequise) {
      setInfo('Compte créé. Confirme ton adresse depuis le mail reçu, puis connecte-toi.');
      setMode('connexion');
      setMdp('');
      return;
    }
    onConnecte();
  };

  const basculer = () => {
    setMode(inscription ? 'connexion' : 'inscription');
    setErreur(null);
    setInfo(null);
  };

  return (
    <div className="connexion">
      <form className="connexion-carte" onSubmit={valider}>
        <img src="/icon.svg" alt="" className="logo" />
        <h1>Gros Sac</h1>
        <p>
          {inscription
            ? 'Crée ton compte : c’est lui qui te place dans les classements.'
            : 'La course au poids perdu entre potes.'}
        </p>

        <input
          className="champ" type="email" inputMode="email" autoComplete="email"
          placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)}
          disabled={enCours} aria-label="Adresse e-mail" autoFocus
        />
        <input
          className="champ" type="password"
          autoComplete={inscription ? 'new-password' : 'current-password'}
          placeholder="Mot de passe" value={mdp} onChange={(e) => setMdp(e.target.value)}
          disabled={enCours} aria-label="Mot de passe"
        />

        {inscription && (
          <>
            <input
              className="champ" placeholder="Ton pseudo" value={pseudo} maxLength={24}
              onChange={(e) => setPseudo(e.target.value)} disabled={enCours} aria-label="Pseudo"
            />
            <div className="emojis" role="radiogroup" aria-label="Ton emblème">
              {EMOJIS.map((x) => (
                <button
                  key={x} type="button" role="radio" aria-checked={emoji === x}
                  className={`emoji${emoji === x ? ' on' : ''}`} onClick={() => setEmoji(x)}
                >{x}</button>
              ))}
            </div>
            <span className="aide">Six caractères minimum pour le mot de passe.</span>
          </>
        )}

        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        {info && <p className="aide" role="status">{info}</p>}

        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={!valide || enCours}>
          {enCours ? 'Un instant…' : inscription ? 'Créer mon compte' : 'Entrer'}
        </button>
        <button className="btn btn-quiet btn-block" type="button" onClick={basculer} disabled={enCours}>
          {inscription ? 'J’ai déjà un compte' : 'Créer un compte'}
        </button>
      </form>
    </div>
  );
}
