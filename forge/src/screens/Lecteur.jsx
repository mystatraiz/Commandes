import { useEffect, useRef, useState } from 'react';
import Feuille from '../components/Feuille.jsx';
import { estimerCalories } from '../lib/circuits.js';
import { armerSon, bipCompte, bip, vibrer } from '../lib/son.js';
import { formatCourt } from '../lib/temps.js';

/*
  Le lecteur enchaîne les étapes d'un plan (circuit ou échauffement) : gros
  compte à rebours, consigne, bips aux changements. Le temps est mesuré sur
  l'horloge, pas sur le nombre de ticks : un onglet mis en arrière-plan ne
  fausse pas le décompte.
*/
export default function Lecteur({ plan, reglages, onTerminer, onQuitter }) {
  const etapes = plan.etapes;
  const [index, setIndex] = useState(0);
  const [restant, setRestant] = useState(etapes[0]?.dureeS || 0);
  const [pause, setPause] = useState(false);
  const [termine, setTermine] = useState(false);
  const [quitter, setQuitter] = useState(false);
  const [calories, setCalories] = useState('');
  const finA = useRef(Date.now() + (etapes[0]?.dureeS || 0) * 1000);
  const debutA = useRef(Date.now());
  const dernierBip = useRef(null);
  const wakeLock = useRef(null);

  const etape = etapes[index];
  const suivante = etapes[index + 1];
  const ecouleTotalS = etapes.slice(0, index).reduce((s, e) => s + e.dureeS, 0) + (etape ? etape.dureeS - restant : 0);
  const totalS = plan.dureeS;

  // Verrou d'écran : le téléphone ne doit pas s'éteindre au milieu d'un tour.
  useEffect(() => {
    let vivant = true;
    (async () => {
      try { wakeLock.current = await navigator.wakeLock?.request('screen'); } catch {}
      if (!vivant) wakeLock.current?.release?.();
    })();
    const reprendre = () => { if (!document.hidden && !wakeLock.current) navigator.wakeLock?.request('screen').then((w) => { wakeLock.current = w; }).catch(() => {}); };
    document.addEventListener('visibilitychange', reprendre);
    return () => { vivant = false; document.removeEventListener('visibilitychange', reprendre); wakeLock.current?.release?.(); };
  }, []);

  useEffect(() => { armerSon(); bip(660, 150); }, []);

  useEffect(() => {
    if (pause || termine || !etape) return;
    const tick = () => {
      const r = Math.max(0, Math.ceil((finA.current - Date.now()) / 1000));
      setRestant(r);
      if (dernierBip.current !== `${index}-${r}` && r <= 3) { dernierBip.current = `${index}-${r}`; bipCompte(r); }
      if (r === 0) {
        if (index + 1 < etapes.length) {
          finA.current = Date.now() + etapes[index + 1].dureeS * 1000;
          setIndex(index + 1);
          setRestant(etapes[index + 1].dureeS);
        } else {
          setTermine(true);
          vibrer([120, 60, 120, 60, 240]);
        }
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [index, pause, termine, etape, etapes]);

  const basculerPause = () => {
    armerSon();
    if (pause) { finA.current = Date.now() + restant * 1000; setPause(false); }
    else { setPause(true); }
  };
  const passer = () => {
    armerSon();
    if (index + 1 < etapes.length) {
      finA.current = Date.now() + etapes[index + 1].dureeS * 1000;
      setIndex(index + 1);
      setRestant(etapes[index + 1].dureeS);
      setPause(false);
    } else setTermine(true);
  };

  const dureeReelleMin = Math.max(1, Math.round((Date.now() - debutA.current) / 60000));
  const estimation = plan.sport === 'renfo' ? estimerCalories(dureeReelleMin, Number(reglages.poidsRef) || 80, 3) : 0;
  const terminer = () => onTerminer({ dureeMin: dureeReelleMin, calories: calories === '' ? estimation : Math.round(Number(calories)) || 0, etapesFaites: termine ? etapes.length : index });

  if (termine || quitter === 'enregistrer') {
    return (
      <div className="ecran">
        <div className="contenu">
          <div className="recap-fin">
            <div className="eyebrow">{termine ? 'Session terminée' : 'Session écourtée'}</div>
            <h1 className="display" style={{ fontSize: 44 }}>{termine ? 'Bien joué.' : 'C’est déjà ça.'}</h1>
            <div className="chiffre xl tabular">{dureeReelleMin}<small>min</small></div>
            <p className="soft">{plan.titre}{plan.tours ? ` · ${plan.tours} tour${plan.tours > 1 ? 's' : ''}` : ''} · {termine ? etapes.length : index}/{etapes.length} étapes</p>
          </div>
          {plan.sport === 'renfo' && (
            <div className="champ-groupe">
              <label htmlFor="kcal-fin">Calories (montre)</label>
              <input id="kcal-fin" className="champ grand" inputMode="numeric" placeholder={String(estimation)} value={calories} onChange={(e) => setCalories(e.target.value)} />
              <span className="aide">Sans valeur, on garde l’estimation : {estimation} kcal pour {dureeReelleMin} min.</span>
            </div>
          )}
          <button className="btn btn-primary btn-lg btn-block" type="button" onClick={terminer}>Enregistrer la session</button>
          <button className="btn btn-quiet btn-block" type="button" onClick={onQuitter}>Ne pas enregistrer</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`ecran lecteur ${etape.type}`}>
      <div className="barre-totale"><i style={{ width: `${(ecouleTotalS / totalS) * 100}%` }} /></div>
      <div className="etat">
        <span>{plan.titre}</span>
        <span>{formatCourt(ecouleTotalS)} / {formatCourt(totalS)}</span>
      </div>
      <div className="centre">
        {plan.tours > 1 && <div className="tour">Tour {etape.tour} / {plan.tours}</div>}
        {etape.phase && <div className="eyebrow acier">{etape.phase}</div>}
        <div className="nom-ex">{etape.nom}</div>
        <div className={`compte tabular${restant <= 3 ? ' fin' : ''}`} aria-live="off">{restant}</div>
        <div className="consigne">{etape.consigne}</div>
        {suivante && <div className="suivant">Ensuite : <b>{suivante.nom}</b> · {formatCourt(suivante.dureeS)}</div>}
        {pause && <div className="eyebrow feu">En pause</div>}
      </div>
      <div className="commandes">
        <button className="btn btn-ghost" type="button" onClick={() => setQuitter(true)} aria-label="Quitter">✕</button>
        <button className={`btn btn-lg ${pause ? 'btn-primary' : 'btn-ghost'}`} type="button" onClick={basculerPause}>{pause ? 'Reprendre' : 'Pause'}</button>
        <button className="btn btn-ghost" type="button" onClick={passer} aria-label="Passer">→</button>
      </div>

      {quitter === true && (
        <Feuille titre="Arrêter ?" onFermer={() => setQuitter(false)}>
          <p className="soft">Tu as fait {index} étape{index > 1 ? 's' : ''} sur {etapes.length}.</p>
          <button className="btn btn-ghost btn-block" type="button" onClick={() => setQuitter('enregistrer')}>Enregistrer quand même</button>
          <button className="btn btn-danger btn-block" type="button" onClick={onQuitter}>Abandonner</button>
        </Feuille>
      )}
    </div>
  );
}
