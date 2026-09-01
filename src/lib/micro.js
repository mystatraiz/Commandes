/* Dictée vocale, via la reconnaissance intégrée au navigateur.

   Aucun service payant, aucune clé, rien à héberger : c'est le téléphone qui
   transcrit. En contrepartie la disponibilité varie — d'où la détection
   explicite plus bas, qui permet de masquer le bouton là où ça ne marche pas
   plutôt que d'offrir une fonction qui échoue.

   À savoir : sur la plupart des navigateurs la transcription passe par les
   serveurs de l'éditeur, elle demande donc du réseau. Le reste de
   l'application continue de fonctionner hors ligne ; seule la dictée est
   indisponible. */

const Moteur =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const dicteeDisponible = Boolean(Moteur);

/**
 * Lance une écoute. Renvoie un objet avec `arreter()`.
 *
 * @param {(texte: string, definitif: boolean) => void} surTexte
 *        appelé au fil de la parole ; `definitif` distingue le texte stabilisé
 *        des hypothèses intermédiaires.
 * @param {(raison: string) => void} surFin
 */
export function ecouter({ surTexte, surFin, langue = 'fr-FR' }) {
  if (!Moteur) { surFin?.('indisponible'); return { arreter() {} }; }

  const reco = new Moteur();
  reco.lang = langue;
  reco.continuous = true;         // une commande tient rarement en un souffle
  reco.interimResults = true;     // afficher au fil de la parole rassure
  reco.maxAlternatives = 1;

  let arrete = false;
  let definitif = '';

  reco.onresult = (e) => {
    let provisoire = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const morceau = e.results[i][0].transcript;
      if (e.results[i].isFinal) definitif += morceau + ' ';
      else provisoire += morceau;
    }
    surTexte?.((definitif + provisoire).trim(), Boolean(definitif));
  };

  reco.onerror = (e) => {
    if (arrete) return;
    const raisons = {
      'not-allowed': 'micro-refuse',
      'service-not-allowed': 'micro-refuse',
      'no-speech': 'rien-entendu',
      network: 'reseau',
      'audio-capture': 'micro-absent',
    };
    surFin?.(raisons[e.error] || 'erreur');
  };

  reco.onend = () => { if (!arrete) surFin?.('fin'); };

  try {
    reco.start();
  } catch {
    surFin?.('erreur');
    return { arreter() {} };
  }

  return {
    arreter() {
      arrete = true;
      try { reco.stop(); } catch {}
    },
  };
}
