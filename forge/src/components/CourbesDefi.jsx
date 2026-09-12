import { useMemo, useRef, useState } from 'react';
import { formatJourMois, formatDateCourte } from '../lib/temps.js';
import { mesureById } from '../lib/defis.js';

/*
  Les courbes de tous les participants, une couleur chacun.

  Les points viennent du fil : une pesée publiée est un point. Quelqu'un qui a
  choisi « rang seul » ne publie aucun chiffre, donc il n'a pas de courbe — on
  ne peut pas dessiner ce qu'on a accepté de ne pas savoir. Il est nommé sous
  le graphique plutôt que passé sous silence.

  Les huit teintes sont celles validées pour un fond sombre : les deux plus
  proches restent distinguables par un daltonien, sans quoi un classement à
  cinq devient illisible.
*/
const TEINTES = ['#3987E5', '#D95926', '#199E70', '#C98500', '#D55181', '#008300', '#9085E9', '#E66767'];

const L = 340;
const M = { h: 12, b: 24, g: 30, d: 54 };

export default function CourbesDefi({ evenements, classement, mesure, hauteur = 176 }) {
  const svgRef = useRef(null);
  const [survol, setSurvol] = useState(null);

  const { series, muets, jours } = useMemo(() => {
    const cle = mesure === 'kilos' ? 'kg' : 'pct';
    const parJoueur = new Map();
    for (const e of [...evenements].reverse()) {            // du plus ancien au plus récent
      if (!parJoueur.has(e.userId)) parJoueur.set(e.userId, { pseudo: e.pseudo, emoji: e.emoji, points: [] });
      const v = e[cle];
      if (v !== null && v !== undefined) parJoueur.get(e.userId).points.push({ jour: e.jour, v });
    }

    const jours = [...new Set(evenements.map((e) => e.jour))].sort();
    // L'ordre du classement donne l'ordre des couleurs : le premier garde la
    // sienne même quand quelqu'un rejoint en cours de route.
    const ordre = classement.length ? classement.map((p) => p.userId) : [...parJoueur.keys()];
    const series = [];
    const muets = [];
    ordre.forEach((userId, i) => {
      const j = parJoueur.get(userId);
      const fiche = classement.find((p) => p.userId === userId);
      const nom = j?.pseudo || fiche?.pseudo || '—';
      if (!j || j.points.length === 0) {
        muets.push({ userId, pseudo: nom, emoji: fiche?.emoji || '💪', raison: fiche?.visibilite === 'rang' ? 'rang seul' : 'pas encore pesé' });
        return;
      }
      series.push({ userId, pseudo: nom, couleur: TEINTES[i % TEINTES.length], points: j.points, moi: fiche?.moi });
    });
    return { series, muets, jours };
  }, [evenements, classement, mesure]);

  const H = hauteur;
  const larg = L - M.g - M.d;
  const haut = H - M.h - M.b;

  if (!jours.length || !series.length) {
    return (
      <p className="aide centre-texte" style={{ padding: '18px 0' }}>
        Les courbes apparaîtront dès que quelqu’un aura publié une pesée.
      </p>
    );
  }

  const x = (jour) => {
    const i = jours.indexOf(jour);
    return M.g + (jours.length > 1 ? (i / (jours.length - 1)) * larg : larg / 2);
  };

  const valeurs = series.flatMap((s) => s.points.map((p) => p.v));
  const brut = Math.max(...valeurs);
  const bas = Math.min(0, Math.floor(Math.min(...valeurs)));
  const haut_ = Math.max(1, Math.ceil(brut * 2) / 2 + 0.3);
  const y = (v) => M.h + haut - ((v - bas) / (haut_ - bas)) * haut;

  const ticks = [];
  const pas = haut_ - bas > 6 ? 2 : 1;
  for (let v = Math.ceil(bas); v <= haut_; v += pas) ticks.push(v);

  const unite = mesureById(mesure).court;
  const chemin = (points) => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.jour).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

  const jalons = jours.length <= 4
    ? jours
    : [jours[0], jours[Math.floor(jours.length / 2)], jours[jours.length - 1]];

  const viser = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * L;
    const i = Math.round(((px - M.g) / larg) * (jours.length - 1));
    setSurvol(jours[Math.max(0, Math.min(jours.length - 1, i))]);
  };

  return (
    <div className="graphique courbes-defi">
      <svg
        ref={svgRef} viewBox={`0 0 ${L} ${H}`} role="img"
        aria-label={`Progression de ${series.map((s) => s.pseudo).join(', ')}`}
        onPointerMove={viser} onPointerDown={viser} onPointerLeave={() => setSurvol(null)}
      >
        <g className="grille">
          {ticks.map((t) => <line key={t} x1={M.g} x2={L - M.d} y1={y(t)} y2={y(t)} />)}
        </g>
        <g className="axe">
          {ticks.map((t) => <text key={t} x={M.g - 5} y={y(t) + 3.2} textAnchor="end">{t} {unite}</text>)}
          {jalons.map((j, i) => (
            <text key={j} x={x(j)} y={H - 8} textAnchor={i === 0 ? 'start' : i === jalons.length - 1 ? 'end' : 'middle'}>
              {formatJourMois(j)}
            </text>
          ))}
        </g>

        {survol && <line className="viseur" x1={x(survol)} x2={x(survol)} y1={M.h} y2={M.h + haut} />}

        {series.map((s) => {
          const dernier = s.points[s.points.length - 1];
          return (
            <g key={s.userId}>
              <path className="courbe" d={chemin(s.points)} stroke={s.couleur} />
              <circle className="point" cx={x(dernier.jour)} cy={y(dernier.v)} r={4.5} fill={s.couleur} />
              <text className="etiquette" x={L - M.d + 8} y={y(dernier.v) + 3.6} fill={s.couleur}>
                {s.pseudo.slice(0, 7).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>

      {survol && (
        <div className="bulle" style={{ [jours.indexOf(survol) > jours.length / 2 ? 'left' : 'right']: '8px' }}>
          <div className="j">{formatDateCourte(survol)}</div>
          {series.map((s) => {
            const p = s.points.filter((q) => q.jour <= survol).pop();
            return (
              <div className="l" key={s.userId}>
                <i style={{ background: s.couleur }} />{s.pseudo}
                <b>{p ? `${p.v.toLocaleString('fr-FR')} ${unite}` : '—'}</b>
              </div>
            );
          })}
        </div>
      )}

      <div className="legende" style={{ marginTop: 10 }}>
        {series.map((s) => (
          <span key={s.userId}><i style={{ background: s.couleur }} />{s.pseudo}{s.moi ? ' · toi' : ''}</span>
        ))}
        {muets.map((m) => (
          <span className="muet" key={m.userId}><i />{m.pseudo} — {m.raison}</span>
        ))}
      </div>
    </div>
  );
}
