import { useRegisterSW } from 'virtual:pwa-register/react';

// Toutes les demi-heures, et à chaque retour au premier plan. Sans cela, une
// application ouverte depuis l'écran d'accueil peut garder des jours durant la
// version qu'elle avait au moment de son installation.
const PERIODE_MS = 30 * 60 * 1000;

/**
 * Enregistrement du service worker.
 *
 * La mise à jour s'applique d'elle-même (`autoUpdate`) : sur un téléphone, un
 * bandeau que l'on ne voit pas laisse tourner une version périmée. Il n'y a
 * rien à afficher, d'où l'absence de rendu.
 */
export default function MajPWA() {
  useRegisterSW({
    onRegisterError: (e) => console.warn('[PWA] enregistrement impossible :', e?.message),
    onRegisteredSW: (url, registration) => {
      if (!registration) return;
      const verifier = () => {
        if (!navigator.onLine) return;
        registration.update().catch(() => {});
      };
      setInterval(verifier, PERIODE_MS);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) verifier(); });
    },
  });
  return null;
}
