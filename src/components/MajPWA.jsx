import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Bandeau de mise à jour.
 *
 * L'installation d'une nouvelle version n'est jamais imposée : recharger en
 * plein coup de feu ferait perdre le geste en cours. On propose, le service
 * décide.
 */
export default function MajPWA() {
  const {
    needRefresh: [aJour, setAJour],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (e) => console.warn('[PWA] enregistrement impossible :', e?.message),
  });

  if (!aJour) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>Nouvelle version disponible</span>
      <button className="btn btn-primary" type="button" onClick={() => updateServiceWorker(true)}>
        Recharger
      </button>
      <button className="btn btn-quiet" type="button" onClick={() => setAJour(false)} aria-label="Plus tard">
        Plus tard
      </button>
    </div>
  );
}
