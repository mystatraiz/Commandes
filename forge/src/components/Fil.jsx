import { useState } from 'react';
import { suggestions, REACTIONS } from '../lib/chambrage.js';
import { formatDateCourte, cleJour } from '../lib/temps.js';

/*
  Le fil.

  Personne n'ouvre une application pour regarder une colonne de pourcentages.
  Ce qui fait revenir, c'est ce que les copains ont répondu — d'où les deux
  phrases proposées sous chaque pesée : une pour encourager, une pour
  charrier, envoyées en un appui. Le tirage est déterministe, donc tout le
  monde se voit proposer la même paire et la conversation garde un sens.
*/

function quand(jour, creeA, maintenant) {
  const ecoule = maintenant - creeA;
  if (ecoule < 3600000) return `il y a ${Math.max(1, Math.round(ecoule / 60000))} min`;
  if (jour === cleJour(maintenant)) return `aujourd’hui, ${new Date(creeA).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return formatDateCourte(jour);
}

function Evenement({ evt, mesure, maintenant, onReagir, onCommenter, onSupprimerCommentaire }) {
  const [tour, setTour] = useState(0);
  const [saisie, setSaisie] = useState('');
  const s = suggestions(evt.id, evt.pseudo, tour);

  const delta = mesure === 'kilos' ? evt.deltaKg : evt.deltaPct;
  const unite = mesure === 'kilos' ? 'kg' : '%';
  const total = mesure === 'kilos' ? evt.kg : evt.pct;

  const envoyer = (texte) => {
    if (!texte.trim()) return;
    onCommenter(evt.id, texte);
    setSaisie('');
  };

  return (
    <article className={`evt${evt.moi ? ' moi' : ''}`}>
      <div className="evt-tete">
        <div className="ico">{evt.emoji}</div>
        <div className="qui">
          <b>{evt.pseudo}{evt.moi ? ' · toi' : ''}</b>
          <span>
            {evt.moi ? 'tu t’es pesé' : 's’est pesé'} · {quand(evt.jour, evt.creeA, maintenant)}
            {total !== null && total !== undefined ? ` · ${total.toLocaleString('fr-FR')} ${unite} au total` : ''}
          </span>
        </div>
        <div className={`delta ${delta === null || delta === undefined ? 'neutre' : delta < 0 ? 'bas' : delta > 0 ? 'haut' : 'neutre'}`}>
          {delta === null || delta === undefined
            ? '—'
            : `${delta > 0 ? '+' : ''}${delta.toLocaleString('fr-FR')} ${unite}`}
        </div>
      </div>

      <div className="reactions">
        {REACTIONS.map((r) => {
          const n = evt.reactions[r] || 0;
          const mienne = evt.miennes.includes(r);
          return (
            <button
              key={r} type="button" className={`reac${mienne ? ' on' : ''}`}
              onClick={() => onReagir(evt.id, r, !mienne)}
              aria-label={`Réagir ${r}${n ? ` (${n})` : ''}`} aria-pressed={mienne}
            >
              {r}{n > 0 && <span className="n">{n}</span>}
            </button>
          );
        })}
      </div>

      {!evt.moi && (
        <div className="suggest">
          <div className="suggest-tete">
            <span className="eyebrow">Balance une vanne</span>
            <button className="relance" type="button" onClick={() => setTour((t) => t + 1)} aria-label="Autres propositions">↻</button>
          </div>
          <button className="phrase pour" type="button" onClick={() => envoyer(s.pour)}>
            <span className="marque" aria-hidden="true">👊</span>{s.pour}
            <span className="envoi">Envoyer</span>
          </button>
          <button className="phrase contre" type="button" onClick={() => envoyer(s.contre)}>
            <span className="marque" aria-hidden="true">🌶️</span>{s.contre}
            <span className="envoi">Envoyer</span>
          </button>
        </div>
      )}

      <div className="commentaires">
        {evt.commentaires.map((c) => (
          <div className={`com${c.moi ? ' moi' : ''}`} key={c.id}>
            <div className="ico">{c.emoji}</div>
            <div className="bulletexte">
              <b>{c.pseudo}{c.moi ? ' · toi' : ''}</b>
              {c.texte}
            </div>
            {c.moi && (
              <button className="effacer" type="button" onClick={() => onSupprimerCommentaire(c.id)} aria-label="Effacer ma vanne">×</button>
            )}
          </div>
        ))}
        <div className="ecrire">
          <input
            value={saisie} onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') envoyer(saisie); }}
            placeholder="Écris ta vanne…" aria-label={`Commenter la pesée de ${evt.pseudo}`} maxLength={400}
          />
          <button className="btn btn-primary" type="button" onClick={() => envoyer(saisie)} disabled={!saisie.trim()}>
            Dire
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Fil({ evenements, mesure, maintenant, onReagir, onCommenter, onSupprimerCommentaire }) {
  if (!evenements.length) {
    return (
      <p className="aide centre-texte" style={{ padding: '14px 0' }}>
        Rien dans le fil. Pèse-toi : les autres pourront réagir.
      </p>
    );
  }
  return (
    <div className="fil">
      {evenements.map((evt) => (
        <Evenement
          key={evt.id} evt={evt} mesure={mesure} maintenant={maintenant}
          onReagir={onReagir} onCommenter={onCommenter} onSupprimerCommentaire={onSupprimerCommentaire}
        />
      ))}
    </div>
  );
}
