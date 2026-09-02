import { useEffect, useState } from 'react';

/** Horloge partagée : un seul intervalle pour tous les chronomètres affichés. */
export function useHorloge(periodeMs = 1000) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), periodeMs);
    const reveil = () => setMaintenant(Date.now());
    document.addEventListener('visibilitychange', reveil);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', reveil); };
  }, [periodeMs]);
  return maintenant;
}

const pad = (n) => String(n).padStart(2, '0');

/** 00:42:07 — pour le chrono du jeûne. */
export function formatChrono(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** 0:42 — pour les compteurs d'exercice. */
export function formatCourt(s) {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** « 45 min », « 1 h 30 », « 16 h 20 » */
export function formatDuree(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const m = min % 60;
  return m ? `${Math.floor(min / 60)} h ${pad(m)}` : `${Math.floor(min / 60)} h`;
}

/** « 16,3 h » pour les heures de jeûne. */
export const formatHeures = (h) => `${(Math.round(h * 10) / 10).toLocaleString('fr-FR')} h`;

/** Clé de journée locale : 2026-09-02 */
export function cleJour(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Minuit local du jour donné (clé ou horodatage). */
export function debutJour(x = Date.now()) {
  const d = typeof x === 'string' ? new Date(`${x}T00:00:00`) : new Date(x);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Clé du jour décalé de n jours (n négatif = passé). */
export function jourPlus(cle, n) {
  const d = new Date(`${cle}T12:00:00`);
  d.setDate(d.getDate() + n);
  return cleJour(d.getTime());
}

/** Les n dernières clés de jour, de la plus ancienne à aujourd'hui. */
export function derniersJours(n, maintenant = Date.now()) {
  const auj = cleJour(maintenant);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(jourPlus(auj, -i));
  return out;
}

export function formatDateCourte(cle) {
  const d = new Date(`${cle}T12:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatJourMois(cle) {
  const d = new Date(`${cle}T12:00:00`);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatHeure(ms) {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Valeur d'un <input type="datetime-local"> pour un horodatage. */
export function versInputDateHeure(ms) {
  const d = new Date(ms);
  return `${cleJour(ms)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
