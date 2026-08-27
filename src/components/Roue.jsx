import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

// Valeur de repli seulement : la hauteur réelle est lue dans le DOM, et c'est
// le CSS (--item-h) qui fait autorité, y compris en paysage.
const HAUTEUR_ITEM = 58;

/**
 * Roue de sélection, dans l'esprit d'un sélecteur iOS.
 *
 * Le défilement reste natif — c'est lui qui donne l'inertie et l'accrochage —
 * et chaque cran est incliné en 3D selon sa distance au centre, ce qui dessine
 * le cylindre. Les transformations sont écrites directement dans le DOM à
 * chaque image plutôt que via l'état React : à 30 crans, un rendu React par
 * pixel défilé saccaderait.
 */
export default function Roue({ items, valeur, onChange, onValider }) {
  const scrollRef = useRef(null);
  const listeRef = useRef(null);
  const indexRef = useRef(Math.max(0, items.indexOf(valeur)));
  const rafRef = useRef(0);
  const initRef = useRef(false);

  const hauteurItem = () => {
    const premier = listeRef.current?.querySelector('.wheel-item');
    return premier?.offsetHeight || HAUTEUR_ITEM;
  };

  const peindre = useCallback(() => {
    const zone = scrollRef.current;
    const liste = listeRef.current;
    if (!zone || !liste) return;
    const h = hauteurItem();
    const position = zone.scrollTop / h;

    // Les crans seulement : les deux espaceurs encadrent la liste et les
    // compter décalerait chaque cran d'un rang.
    const noeuds = liste.querySelectorAll('.wheel-item');
    for (let i = 0; i < noeuds.length; i++) {
      const d = i - position;                       // distance en crans
      const abs = Math.abs(d);
      if (abs > 3.6) {
        // Hors de la fenêtre visible : inutile de calculer, on masque.
        noeuds[i].style.opacity = '0';
        continue;
      }
      // Pas de translateZ : il déplacerait le cran verticalement en plus du
      // défilement, et les crans éloignés sortiraient du cadre. L'inclinaison
      // seule, vue en perspective, suffit à dessiner le cylindre.
      const angle = Math.max(-70, Math.min(70, d * 22));
      noeuds[i].style.transform = `rotateX(${-angle}deg) scale(${1 - abs * 0.06})`;
      noeuds[i].style.opacity = String(Math.max(0.14, 1 - abs * 0.24));
    }
  }, []);

  const surDefilement = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      peindre();
      const zone = scrollRef.current;
      if (!zone) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(zone.scrollTop / hauteurItem())));
      if (i !== indexRef.current) {
        indexRef.current = i;
        // Petit à-coup à chaque cran franchi, comme un vrai cliquet.
        try { navigator.vibrate?.(6); } catch {}
        listeRef.current?.querySelectorAll('.wheel-item').forEach((n, k) => {
          n.classList.toggle('on', k === i);
        });
        onChange(items[i]);
      }
    });
  }, [items, onChange, peindre]);

  // Positionnement initial : sans animation, sinon la roue « tombe » à l'ouverture.
  useLayoutEffect(() => {
    const zone = scrollRef.current;
    if (!zone || initRef.current) return;
    initRef.current = true;
    const i = Math.max(0, items.indexOf(valeur));
    indexRef.current = i;
    zone.scrollTop = i * hauteurItem();
    peindre();
    listeRef.current?.querySelectorAll('.wheel-item').forEach((n, k) => n.classList.toggle('on', k === i));
  }, [items, valeur, peindre]);

  // Une rotation d'écran change la hauteur des crans : on se recale dessus.
  useEffect(() => {
    const recaler = () => {
      const zone = scrollRef.current;
      if (!zone) return;
      zone.scrollTop = indexRef.current * hauteurItem();
      peindre();
    };
    window.addEventListener('resize', recaler);
    window.addEventListener('orientationchange', recaler);
    return () => {
      window.removeEventListener('resize', recaler);
      window.removeEventListener('orientationchange', recaler);
      cancelAnimationFrame(rafRef.current);
    };
  }, [peindre]);

  const allerA = (i) => {
    const zone = scrollRef.current;
    if (!zone) return;
    zone.scrollTo({ top: i * hauteurItem(), behavior: 'smooth' });
  };

  const auClavier = (e) => {
    const i = indexRef.current;
    if (e.key === 'ArrowDown') { e.preventDefault(); allerA(Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); allerA(Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); allerA(0); }
    else if (e.key === 'End') { e.preventDefault(); allerA(items.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); onValider?.(); }
  };

  return (
    <div className="wheel-wrap">
      <div className="wheel-frame" aria-hidden="true" />
      <div
        className="wheel"
        ref={scrollRef}
        onScroll={surDefilement}
        onKeyDown={auClavier}
        tabIndex={0}
        role="listbox"
        aria-label="Numéro de table"
        aria-activedescendant={`table-${valeur}`}
      >
        <div ref={listeRef} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="wheel-pad" aria-hidden="true" />
          {items.map((t, i) => (
            <div
              key={t}
              id={`table-${t}`}
              className="wheel-item"
              role="option"
              aria-selected={t === valeur}
              onClick={() => allerA(i)}
            >
              {t}
            </div>
          ))}
          <div className="wheel-pad" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

