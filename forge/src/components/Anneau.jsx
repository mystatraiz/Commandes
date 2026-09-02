/** Anneau de progression. `valeur` entre 0 et 1 ; au-delà de 1, l'anneau reste plein. */
export default function Anneau({ valeur = 0, taille = 200, epaisseur = 14, couleur = 'var(--lime)', children }) {
  const r = (taille - epaisseur) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number.isFinite(valeur) ? valeur : 0));
  return (
    <div className="anneau-wrap" style={{ width: taille, height: taille }}>
      <svg className="anneau" width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} aria-hidden="true">
        <circle className="fond" cx={taille / 2} cy={taille / 2} r={r} fill="none" strokeWidth={epaisseur} />
        <circle
          className="val" cx={taille / 2} cy={taille / 2} r={r} fill="none" strokeWidth={epaisseur}
          stroke={couleur} strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          style={{ filter: v > 0 ? `drop-shadow(0 0 6px ${couleur})` : 'none' }}
        />
      </svg>
      <div className="centre">{children}</div>
    </div>
  );
}
