import { ECHAUFFEMENT_PADEL, dureeEchauffementS } from '../lib/echauffement.js';
import { formatCourt } from '../lib/temps.js';

export default function Echauffement({ onLancer, onRetour }) {
  const total = dureeEchauffementS();
  return (
    <div className="ecran">
      <header className="topbar">
        <button className="btn btn-ghost btn-icon" type="button" onClick={onRetour} aria-label="Retour">←</button>
        <div className="titre"><h1>Échauffement padel</h1><span className="sous">{ECHAUFFEMENT_PADEL.accroche}</span></div>
      </header>
      <div className="contenu">
        <section className="carte hero acier">
          <div className="rayures" />
          <div className="carte-tete"><span className="eyebrow acier">Avant chaque session</span><span className="chiffre md tabular">{formatCourt(total)}</span></div>
          <p className="soft" style={{ fontSize: 14 }}>
            Dix minutes, quatre paliers : réveil, mobilité, activation, accélération. Le lecteur enchaîne les étapes, bipe aux changements, tu n’as qu’à suivre.
          </p>
        </section>
        <section className="carte plan">
          <ol>
            {ECHAUFFEMENT_PADEL.etapes.map((e) => (
              <li key={e.nom}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{e.nom}</div>
                  <div className="aide">{e.consigne}</div>
                </div>
                <span className="z">{e.phase} · {formatCourt(e.dureeS)}</span>
              </li>
            ))}
          </ol>
        </section>
        <button className="btn btn-primary btn-lg btn-block" type="button" onClick={onLancer}>Lancer l’échauffement</button>
      </div>
    </div>
  );
}
