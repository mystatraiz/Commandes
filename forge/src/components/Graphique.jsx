import { useMemo, useRef, useState } from 'react';
import { bornes } from '../lib/series.js';
import { formatDateCourte, formatJourMois } from '../lib/temps.js';

/*
  Courbe(s) sur un axe de jours. Une seule échelle par graphique : pour
  superposer des grandeurs différentes, on passe des séries déjà indexées
  (0–1) avec `indexe`, et la bulle affiche les vraies valeurs (`brut`).

  Le survol est contrôlable de l'extérieur (`survol` / `onSurvol`) pour que
  plusieurs panneaux empilés partagent le même curseur.
*/

const L = 300;   // largeur de référence du viewBox
const MARGE = { h: 8, b: 22, g: 34, d: 10 };

export default function Graphique({
  jours, series, hauteur = 150, zero = false, indexe = false, survol, onSurvol, tendance, formatAxe,
}) {
  const [survolLocal, setSurvolLocal] = useState(null);
  const svgRef = useRef(null);
  const i = survol === undefined ? survolLocal : survol;
  const poser = (v) => { setSurvolLocal(v); onSurvol?.(v); };

  const H = hauteur;
  const larg = L - MARGE.g - MARGE.d;
  const haut = H - MARGE.h - MARGE.b;
  const n = jours.length;
  const x = (k) => MARGE.g + (n > 1 ? (k / (n - 1)) * larg : larg / 2);

  const { min, max } = useMemo(() => {
    if (indexe) return { min: 0, max: 1 };
    const tout = series.flatMap((s) => s.valeurs).concat(tendance || []);
    return bornes(tout, { zero });
  }, [series, tendance, zero, indexe]);
  const y = (v) => MARGE.h + haut - ((v - min) / (max - min || 1)) * haut;

  const ticks = useMemo(() => {
    if (indexe) return [0, 0.5, 1];
    const pas = (max - min) / 3;
    return [0, 1, 2, 3].map((k) => min + k * pas);
  }, [min, max, indexe]);

  const fmt = (v) => (indexe ? `${Math.round(v * 100)} %` : formatAxe ? formatAxe(v) : (Math.round(v * 10) / 10).toLocaleString('fr-FR'));

  const chemin = (vals) => {
    let d = '';
    let ouvert = false;
    vals.forEach((v, k) => {
      if (v === null || v === undefined || !Number.isFinite(v)) { ouvert = false; return; }
      d += `${ouvert ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)} `;
      ouvert = true;
    });
    return d;
  };

  const surPointeur = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * L;
    const k = Math.round(((px - MARGE.g) / larg) * (n - 1));
    poser(Math.max(0, Math.min(n - 1, k)));
  };

  const pasEtiquette = n <= 8 ? 1 : n <= 16 ? 3 : n <= 35 ? 7 : 15;
  const afficherPoints = n <= 31;

  return (
    <div className="graphique">
      <svg
        ref={svgRef} viewBox={`0 0 ${L} ${H}`} role="img"
        aria-label={series.map((s) => s.nom).join(', ')}
        onPointerMove={surPointeur} onPointerDown={surPointeur} onPointerLeave={() => poser(null)}
      >
        <g className="grille">
          {ticks.map((t) => <line key={t} x1={MARGE.g} x2={L - MARGE.d} y1={y(t)} y2={y(t)} />)}
        </g>
        <g className="axe">
          {ticks.map((t) => <text key={t} x={MARGE.g - 5} y={y(t) + 3.5} textAnchor="end">{fmt(t)}</text>)}
          {jours.map((j, k) => (k % pasEtiquette === 0 || k === n - 1) && (n <= 8 || k !== n - 1 || (n - 1) % pasEtiquette >= 2) ? (
            <text key={j} x={x(k)} y={H - 6} textAnchor={k === 0 ? 'start' : k === n - 1 ? 'end' : 'middle'}>{n <= 8 ? formatDateCourte(j).split(' ')[0] : formatJourMois(j)}</text>
          ) : null)}
        </g>
        {tendance && <path className="tendance" d={chemin(tendance)} stroke={series[0]?.couleur} />}
        {series.map((s) => (
          <g key={s.id}>
            <path className="courbe" d={chemin(s.valeurs)} stroke={s.couleur} />
            {afficherPoints && s.valeurs.map((v, k) => (v === null || v === undefined || !Number.isFinite(v)) ? null : (
              <circle key={k} className="point" cx={x(k)} cy={y(v)} r={i === k ? 5 : 3.5} fill={s.couleur} />
            ))}
            {!afficherPoints && i !== null && s.valeurs[i] !== null && s.valeurs[i] !== undefined && (
              <circle className="point" cx={x(i)} cy={y(s.valeurs[i])} r={5} fill={s.couleur} />
            )}
          </g>
        ))}
        {i !== null && i !== undefined && (
          <g className="curseur"><line x1={x(i)} x2={x(i)} y1={MARGE.h} y2={MARGE.h + haut} /></g>
        )}
      </svg>
      {i !== null && i !== undefined && jours[i] && (
        <div className="bulle" style={{ [i > n / 2 ? 'right' : 'left']: `${MARGE.g / L * 100 + 4}%` }}>
          <div className="j">{formatDateCourte(jours[i])}</div>
          {series.map((s) => {
            const brut = s.brut ? s.brut[i] : s.valeurs[i];
            return (
              <div className="l" key={s.id}>
                <i style={{ background: s.couleur }} />{s.nom}
                <b>{brut === null || brut === undefined ? '—' : `${s.format ? s.format(brut) : brut}`}</b>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
