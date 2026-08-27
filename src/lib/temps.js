import { useEffect, useState } from 'react';

/** Horloge partagée : un seul intervalle pour tous les chronomètres affichés. */
export function useHorloge(periodeMs = 1000) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), periodeMs);
    // Au retour d'arrière-plan, les intervalles peuvent avoir été gelés.
    const reveil = () => setMaintenant(Date.now());
    document.addEventListener('visibilitychange', reveil);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', reveil); };
  }, [periodeMs]);
  return maintenant;
}

/** 0'42 · 12'05 · 1h07 */
export function formatChrono(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}′${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

/** Durée lisible pour les statistiques : « 7 min », « 1 h 04 ». */
export function formatDuree(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

export function debutDeJournee(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function ilYaNJours(n) {
  return debutDeJournee() - n * 86400000;
}
