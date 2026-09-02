import { useEffect } from 'react';

/** Panneau qui monte du bas. Se ferme au toucher du voile ou avec Échap. */
export default function Feuille({ titre, onFermer, children }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onFermer]);
  return (
    <div className="voile" onClick={onFermer} role="presentation">
      <div className="feuille" role="dialog" aria-modal="true" aria-label={titre} onClick={(e) => e.stopPropagation()}>
        <div className="poignee" />
        {titre && <h2>{titre}</h2>}
        {children}
      </div>
    </div>
  );
}
