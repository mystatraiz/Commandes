import Anneau from '../components/Anneau.jsx';
import { jeuneEnCours, dureeJeuneMs, phaseCourante } from '../lib/jeune.js';
import { bilanPoids } from '../lib/series.js';
import { message } from '../lib/gamification.js';
import { formatChrono, formatHeures } from '../lib/temps.js';

function Partage({ etat }) {
  if (!etat?.actif) return null;
  if (etat.enAttente > 0) return <span className="lien-etat attente"><i /> {etat.enAttente} en attente</span>;
  if (!etat.connecte) return <span className="lien-etat"><i /> Hors ligne</span>;
  return <span className="lien-etat ok"><i /> Synchro</span>;
}

export default function Accueil({ entrees, reglages, resume, maintenant, etatSync, onOnglet, onOuvrir, onDemarrerJeune, onTerminerJeune }) {
  const jeune = jeuneEnCours(entrees);
  const { serie, niveau, missions, semaine, series7 } = resume;
  const prenom = reglages.prenom?.trim();
  const date = new Date(maintenant).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const bilan = bilanPoids(entrees, maintenant);
  const objectifH = Number(reglages.objectifJeuneH) || 16;
  const moyJeune = series7.jeune.reduce((s, v) => s + v, 0) / 7;
  const kcal7 = series7.activite.reduce((s, v) => s + v, 0);
  const faites = missions.filter((m) => m.fait).length;

  return (
    <div className="ecran">
      <div className="contenu avec-nav">
        <header className="entete-accueil">
          <div className="salut">
            <h1>{prenom ? `Salut ${prenom}` : 'Salut champion'}</h1>
            <div className="date">{date}</div>
            <Partage etat={etatSync} />
          </div>
          <div className={`flamme${serie.courante === 0 ? ' eteinte' : !serie.aujourdhui ? ' danger' : ''}`} title="Jours consécutifs actifs">
            <span aria-hidden="true">🔥</span>{serie.courante}
            <small>{serie.courante > 1 ? 'jours' : 'jour'}</small>
          </div>
        </header>

        <section className="carte">
          <div className="niveau">
            <div className="badge-niveau">{niveau.n}</div>
            <div className="info">
              <div className="nom">{niveau.nom}</div>
              <div className="xp tabular">{niveau.xp.toLocaleString('fr-FR')} XP · {niveau.pourSuivant - niveau.dansNiveau} avant le niveau {niveau.n + 1}</div>
              <div className="jauge"><i style={{ width: `${Math.round(niveau.progression * 100)}%` }} /></div>
            </div>
            <div className="chiffre md lime">+{resume.xpAujourdhui}<small>XP</small></div>
          </div>
        </section>

        <p className="punchline">{message({ serie, missions, jeuneEnCours: jeune }, maintenant)}</p>

        {jeune ? (
          <section className="carte hero" aria-label="Jeûne en cours">
            <div className="rayures" />
            <div className="carte-tete"><span className="eyebrow">Jeûne en cours</span></div>
            <div className="rangee" style={{ alignItems: 'center' }}>
              <Anneau valeur={dureeJeuneMs(jeune, maintenant) / 3600000 / (Number(jeune.donnees?.objectifH) || objectifH)} taille={112} epaisseur={10}>
                <div className="chiffre md tabular" style={{ fontSize: 22 }}>{Math.floor(dureeJeuneMs(jeune, maintenant) / 3600000)}<small>h</small></div>
              </Anneau>
              <div style={{ flex: 2 }}>
                <div className="chiffre lg tabular" style={{ fontSize: 34 }}>{formatChrono(dureeJeuneMs(jeune, maintenant))}</div>
                <div className="soft" style={{ fontSize: 13, marginTop: 4 }}>{phaseCourante(dureeJeuneMs(jeune, maintenant) / 3600000).nom} · objectif {jeune.donnees?.objectifH || objectifH} h</div>
                <div className="rangee" style={{ marginTop: 10 }}>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => onOnglet('jeune')}>Détails</button>
                  <button className="btn btn-feu btn-sm" type="button" onClick={() => onTerminerJeune(jeune)}>Terminer</button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="carte hero">
            <div className="rayures" />
            <div className="carte-tete"><span className="eyebrow">Jeûne</span></div>
            <h2 className="titre-carte">Aucun jeûne en cours</h2>
            <p className="soft" style={{ fontSize: 13, margin: '6px 0 12px' }}>Moyenne des 7 derniers jours : {formatHeures(moyJeune)}.</p>
            <button className="btn btn-primary btn-block" type="button" onClick={() => onDemarrerJeune(objectifH)}>Lancer un jeûne {objectifH} h</button>
          </section>
        )}

        <section className="carte">
          <div className="carte-tete">
            <span className="eyebrow">Missions du jour</span>
            <span className="chiffre md tabular" style={{ fontSize: 20 }}>{faites}<small>/ {missions.length}</small></span>
          </div>
          <div className="missions">
            {missions.map((m) => (
              <div className={`mission${m.fait ? ' fait' : ''}`} key={m.id}>
                <div className="coche" aria-hidden="true">{m.fait ? '✓' : ''}</div>
                <div className="txt"><div className="t">{m.titre}</div><div className="d">{m.detail}</div></div>
                <div className="xp">+{m.xp}</div>
              </div>
            ))}
          </div>
          {faites === missions.length && <p className="lime" style={{ marginTop: 10, fontWeight: 700, fontSize: 14 }}>⭐ Journée parfaite : +50 XP bonus.</p>}
        </section>

        <div className="actions">
          <button className="action acier" type="button" onClick={() => onOuvrir('poids')}><span className="ico">⚖️</span>Poids</button>
          <button className="action lime" type="button" onClick={() => onOuvrir('session', { sport: 'padel' })}><span className="ico">🎾</span>Padel</button>
          <button className="action feu" type="button" onClick={() => onOuvrir('renfo')}><span className="ico">💪</span>Renfo</button>
          <button className="action acier" type="button" onClick={() => onOuvrir('echauffement')}><span className="ico">🌡️</span>Échauff.</button>
        </div>

        <section className="carte">
          <div className="carte-tete"><span className="eyebrow feu">Cette semaine</span></div>
          <div className="rangee" style={{ alignItems: 'center' }}>
            <Anneau valeur={semaine.sessions / semaine.objectif} taille={96} epaisseur={9} couleur="var(--feu)">
              <div className="chiffre md tabular" style={{ fontSize: 24 }}>{semaine.sessions}<small>/{semaine.objectif}</small></div>
            </Anneau>
            <div className="tuiles" style={{ flex: 2 }}>
              <div className="tuile"><div className="k">Sessions</div><div className="v">{semaine.sessions}<small>/ {semaine.objectif}</small></div></div>
              <div className="tuile"><div className="k">Brûlées</div><div className="v">{semaine.kcal.toLocaleString('fr-FR')}<small>kcal</small></div></div>
            </div>
          </div>
        </section>

        <div className="tuiles trois">
          <button className="tuile" type="button" onClick={() => onOuvrir('poids')} style={{ textAlign: 'left' }}>
            <div className="k">Poids</div>
            <div className="v">{bilan ? bilan.dernier.toLocaleString('fr-FR') : '—'}<small>kg</small></div>
            {bilan?.tendance7j !== null && bilan?.tendance7j !== undefined && (
              <div className={`d ${bilan.tendance7j < 0 ? 'delta-bas' : bilan.tendance7j > 0 ? 'delta-haut' : ''}`}>{bilan.tendance7j > 0 ? '+' : ''}{bilan.tendance7j} kg / 7 j</div>
            )}
            {!bilan && <div className="d">À saisir</div>}
          </button>
          <button className="tuile" type="button" onClick={() => onOnglet('jeune')} style={{ textAlign: 'left' }}>
            <div className="k">Jeûne 7 j</div>
            <div className="v">{(Math.round(moyJeune * 10) / 10).toLocaleString('fr-FR')}<small>h/j</small></div>
            <div className="d">moyenne</div>
          </button>
          <button className="tuile" type="button" onClick={() => onOnglet('courbes')} style={{ textAlign: 'left' }}>
            <div className="k">Activité 7 j</div>
            <div className="v">{kcal7.toLocaleString('fr-FR')}<small>kcal</small></div>
            <div className="d">{series7.sessions.reduce((s, v) => s + v, 0)} session{series7.sessions.reduce((s, v) => s + v, 0) > 1 ? 's' : ''}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
