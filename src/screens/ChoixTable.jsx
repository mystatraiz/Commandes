import { TABLES } from '../config.js';
import Roue from '../components/Roue.jsx';

export default function ChoixTable({ valeur, onChange, onValider, onRetour }) {
  return (
    <>
      <header className="topbar">
        <button className="btn btn-quiet btn-icon" type="button" onClick={onRetour} aria-label="Annuler">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="title">
          Nouvelle commande
          <span className="sub">Étape 1 sur 2 — la table</span>
        </h1>
      </header>

      <div className="wheel-screen">
        <span className="wheel-label">Numéro de table</span>
        <Roue items={TABLES} valeur={valeur} onChange={onChange} onValider={onValider} />
      </div>

      <div className="footer-bar">
        <button className="btn btn-primary btn-lg btn-block" type="button" onClick={onValider}>
          Table {valeur} — continuer
        </button>
      </div>
    </>
  );
}
