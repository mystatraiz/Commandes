import { statutDefi, STATUTS, joursRestants, joursTotal, progressionTemps, mesureById, formatValeur } from '../lib/defis.js';
import { formatJourMois } from '../lib/temps.js';
import { syncActive } from '../supabase.js';
import BoutonPartage from '../components/BoutonPartage.jsx';
import { messageApp, lienApp } from '../lib/partage.js';

function Carte({ defi, maintenant, onOuvrir }) {
  const statut = statutDefi(defi, maintenant);
  const { nom, teinte } = STATUTS[statut];
  const restants = joursRestants(defi, maintenant);
  const part = defi.participation;
  const valeur = part?.valeur === null || part?.valeur === undefined ? null : Number(part.valeur);

  return (
    <button className={`circuit ${teinte}`} type="button" onClick={() => onOuvrir(defi)}>
      <div className="txt">
        <div className="n">{defi.nom}</div>
        <div className="a">
          {statut === 'a_venir' && `Départ le ${formatJourMois(defi.debut)}`}
          {statut === 'en_cours' && `${restants} jour${restants > 1 ? 's' : ''} restant${restants > 1 ? 's' : ''}`}
          {statut === 'termine' && `Terminé le ${formatJourMois(defi.fin)}`}
        </div>
        <div className="c">{nom} · {mesureById(defi.mesure).nom} · {joursTotal(defi)} jours</div>
        {statut === 'en_cours' && (
          <div className="jauge" style={{ marginTop: 8 }}>
            <i style={{ width: `${Math.round(progressionTemps(defi, maintenant) * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="v tabular" style={{ textAlign: 'right' }}>
        {formatValeur(valeur, defi.mesure)}
        <small>ta perte</small>
      </div>
    </button>
  );
}

export default function Defis({ defis, chargement, erreur, maintenant, onOuvrir, onCreer, onRejoindre, onRafraichir, onExemple }) {
  const invitation = messageApp(lienApp(typeof window === 'undefined' ? '' : window.location.href));
  const enCours = defis.filter((d) => statutDefi(d, maintenant) === 'en_cours');
  const aVenir = defis.filter((d) => statutDefi(d, maintenant) === 'a_venir');
  const termines = defis.filter((d) => statutDefi(d, maintenant) === 'termine');

  return (
    <div className="ecran">
      <header className="topbar">
        <div className="titre">
          <h1>Défis</h1>
          <span className="sous">
            {defis.length ? `${enCours.length} en cours · ${defis.length} au total` : 'La course au poids perdu'}
          </span>
        </div>
        {onRafraichir && (
          <button className="btn btn-ghost btn-icon" type="button" onClick={onRafraichir} aria-label="Rafraîchir">↻</button>
        )}
      </header>

      <div className="contenu avec-nav">
        {!syncActive ? (
          <div className="vide">
            <div className="big">🥊</div>
            <h3>Les défis demandent un compte</h3>
            <p>
              Il faut configurer Supabase pour que plusieurs personnes puissent courir ensemble.
              Le reste de l’application fonctionne sans, sur cet appareil.
            </p>
            <button className="btn btn-ghost" type="button" onClick={onExemple} style={{ marginTop: 16 }}>
              Voir à quoi ça ressemble
            </button>
            {/* Envoyer l'application ne demande pas de compte : c'est même
                comme ça qu'on en trouve d'autres à qui se mesurer. */}
            <div style={{ marginTop: 10 }}>
              <BoutonPartage {...invitation} libelle="Partager Gros Sac" classe="btn btn-quiet btn-sm" />
            </div>
          </div>
        ) : (
          <>
            <div className="rangee">
              <button className="btn btn-primary" style={{ flex: 1 }} type="button" onClick={onCreer}>Créer un défi</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} type="button" onClick={onRejoindre}>Rejoindre</button>
            </div>

            {erreur && <div className="anomalie" role="alert"><strong>Défis indisponibles.</strong>{erreur}</div>}

            {chargement && !defis.length && <p className="aide centre-texte">Chargement…</p>}

            {!chargement && !defis.length && !erreur && (
              <div className="vide">
                <div className="big">🥊</div>
                <h3>Aucun défi</h3>
                <p>
                  Crée-en un, envoie le code à tes potes, et que le meilleur gagne.
                  Ou entre le code que quelqu’un t’a envoyé.
                </p>
                <button className="btn btn-ghost" type="button" onClick={onExemple} style={{ marginTop: 16 }}>
                  Voir à quoi ça ressemble
                </button>
              </div>
            )}

            {defis.length > 0 && (
              <button className="btn btn-quiet btn-sm" type="button" onClick={onExemple} style={{ alignSelf: 'center' }}>
                Voir un défi d’exemple
              </button>
            )}

            {[['En cours', enCours], ['À venir', aVenir], ['Terminés', termines]].map(([titre, liste]) =>
              liste.length ? (
                <section key={titre}>
                  <div className="carte-tete"><span className="eyebrow">{titre}</span></div>
                  <div className="circuits">
                    {liste.map((d) => <Carte key={d.id} defi={d} maintenant={maintenant} onOuvrir={onOuvrir} />)}
                  </div>
                </section>
              ) : null,
            )}

            <section className="carte">
              <div className="carte-tete"><span className="eyebrow acier">Faire venir du monde</span></div>
              <p className="aide" style={{ marginBottom: 10 }}>
                Sans adversaire, un défi n’est qu’un tableau de chiffres. Envoie l’application à qui tu
                comptes battre — le défi, tu l’enverras de l’intérieur.
              </p>
              <BoutonPartage {...invitation} libelle="Partager Gros Sac" classe="btn btn-ghost btn-block" />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
