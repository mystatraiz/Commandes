import { useEffect, useRef, useState } from 'react';
import { texteComplet } from '../lib/partage.js';

/*
  Partager.

  Sur téléphone, le geste attendu est la feuille de partage du système : elle
  connaît les groupes, les SMS et les contacts, l'application non. Quand elle
  manque — la plupart des navigateurs de bureau —, on copie dans le
  presse-papiers : un collage plus loin, on est au même endroit. Et si les deux
  sont refusés, on affiche le message à recopier plutôt que d'échouer sans
  rien dire.
*/
export default function BoutonPartage({
  titre, texte, lien, libelle, classe = 'btn btn-primary btn-block', disabled = false,
}) {
  const [etat, setEtat] = useState(null);   // 'envoye' | 'copie' | 'manuel'
  const minuteur = useRef(0);

  useEffect(() => () => clearTimeout(minuteur.current), []);

  const eclair = (x) => {
    setEtat(x);
    clearTimeout(minuteur.current);
    if (x !== 'manuel') minuteur.current = setTimeout(() => setEtat(null), 2500);
  };

  const partager = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: titre, text: texte, url: lien });
        eclair('envoye');
        return;
      } catch (e) {
        // Refermer la feuille de partage n'est pas un échec : on se tait.
        if (e?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(texteComplet({ texte, lien }));
      eclair('copie');
    } catch { eclair('manuel'); }
  };

  return (
    <>
      <button className={classe} type="button" onClick={partager} disabled={disabled}>
        {etat === 'envoye' ? 'Envoyé ✓' : etat === 'copie' ? 'Message copié ✓' : libelle}
      </button>
      {etat === 'manuel' && (
        <div className="a-recopier">
          <span className="aide">Ce navigateur refuse le presse-papiers. Voilà le message, à recopier :</span>
          <textarea
            className="champ" readOnly rows={5} value={texteComplet({ texte, lien })}
            aria-label="Message d’invitation à recopier" onFocus={(e) => e.target.select()}
          />
        </div>
      )}
    </>
  );
}
