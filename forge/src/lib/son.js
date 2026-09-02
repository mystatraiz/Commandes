/* Bips du lecteur d'exercices : WebAudio, sans fichier à charger. */

let ctx = null;

function contexte() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/** À appeler sur un geste utilisateur : débloque l'audio sur iOS. */
export function armerSon() {
  const c = contexte();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function bip(frequence = 880, dureeMs = 120, volume = 0.25) {
  const c = contexte();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.value = frequence;
    g.gain.value = volume;
    o.connect(g).connect(c.destination);
    const t = c.currentTime;
    o.start(t);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dureeMs / 1000);
    o.stop(t + dureeMs / 1000 + 0.02);
  } catch {}
}

export const vibrer = (motif) => { try { navigator.vibrate?.(motif); } catch {} };

/** Compte à rebours : 3, 2, 1 puis un bip long. */
export function bipCompte(secondesRestantes) {
  if (secondesRestantes === 0) { bip(1320, 380, 0.3); vibrer([80, 40, 160]); }
  else if (secondesRestantes <= 3) { bip(880, 100); vibrer(30); }
}
