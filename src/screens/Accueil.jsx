import { SEUIL_ORANGE, SEUIL_ROUGE, cuissonById, grilladeById } from '../config.js';
import { formatChrono, useHorloge } from '../lib/temps.js';

function classeAge(minutes) {
  if (minutes >= SEUIL_ROUGE) return 'hot';
  if (minutes >= SEUIL_ORANGE) return 'warn';
  return '';
}

function Commande({ cmd, maintenant, onServir }) {
  const ecoule = maintenant - cmd.creeeA;
  const pieces = cmd.lignes.reduce((s, l) => s + l.qte, 0);
  const heure = new Date(cmd.creeeA).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <article className={`order ${classeAge(ecoule / 60000)}`}>
      <div className="order-head">
        <h2 className="order-table">
          Table {cmd.table} <span>· {pieces} pièce{pieces > 1 ? 's' : ''} · {heure}</span>
        </h2>
        <span className="chrono tabular" aria-label={`Depuis ${formatChrono(ecoule)}`}>
          {formatChrono(ecoule)}
        </span>
      </div>

      <ul className="order-items">
        {cmd.lignes.map((l, i) => {
          const g = grilladeById(l.grillade);
          const c = cuissonById(l.cuisson);
          return (
            <li className="order-line" key={`${l.grillade}-${l.cuisson}-${i}`}>
              <span
                className="qty"
                style={c ? { background: c.couleur, color: c.encre } : { background: 'var(--surface-3)' }}
              >
                {l.qte}
              </span>
              <span className="nom">{g ? g.nom : l.grillade}</span>
              {c && <span className="cuisson">{c.nom}</span>}
            </li>
          );
        })}
      </ul>

      <div className="order-foot">
        <button className="btn btn-ok" type="button" onClick={() => onServir(cmd.id)}>
          ✓ Servi
        </button>
      </div>
    </article>
  );
}

/* État du partage : discret quand tout va bien, visible dès que des commandes
   attendent d'être transmises — c'est le moment où il faut le savoir. */
function Partage({ etat }) {
  if (!etat?.actif) return null;
  if (etat.enAttente > 0) {
    return (
      <span className="lien-etat attente" title="Commandes prises hors ligne, en attente d’envoi">
        <i /> {etat.enAttente} en attente
      </span>
    );
  }
  if (!etat.connecte) {
    return <span className="lien-etat hors" title="Hors ligne — la saisie continue normalement"><i /> Hors ligne</span>;
  }
  return <span className="lien-etat ok" title="Commandes partagées avec les autres téléphones"><i /> Partagé</span>;
}

/* Un refus du serveur n'est pas une coupure réseau : le dire clairement évite
   de chercher un problème de wifi quand la base n'est pas encore installée.
   Le message disparaît de lui-même dès qu'un échange aboutit. */
function Anomalie({ etat }) {
  if (!etat?.actif || !etat.erreur) return null;
  const tableAbsente = /grill_commandes|does not exist|schema cache/i.test(etat.erreur);
  return (
    <div className="anomalie" role="alert">
      <strong>Le partage ne fonctionne pas.</strong>{' '}
      {tableAbsente
        ? 'La table n’existe pas encore : lancez supabase/schema.sql dans le SQL Editor de Supabase.'
        : etat.erreur}
      <span className="note">Les commandes continuent d’être enregistrées sur ce téléphone.</span>
    </div>
  );
}

export default function Accueil({ commandes, etatSync, onNouvelle, onDicter, onServir, onStats }) {
  const maintenant = useHorloge(1000);
  const pieces = commandes.reduce((s, c) => s + c.lignes.reduce((n, l) => n + l.qte, 0), 0);

  return (
    <>
      <header className="topbar">
        <h1 className="title">
          Commandes
          <span className="sub">
            {commandes.length
              ? `${commandes.length} en cours · ${pieces} pièce${pieces > 1 ? 's' : ''} au grill`
              : 'Aucune commande en cours'}
          </span>
        </h1>
        <Partage etat={etatSync} />
        <button className="btn btn-ghost btn-icon" type="button" onClick={onStats} aria-label="Statistiques">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="12" width="4.2" height="8" rx="1.4" fill="currentColor" />
            <rect x="9.9" y="7" width="4.2" height="13" rx="1.4" fill="currentColor" opacity=".72" />
            <rect x="16.8" y="3.5" width="4.2" height="16.5" rx="1.4" fill="currentColor" opacity=".5" />
          </svg>
        </button>
      </header>

      <div className="newbar">
        <button className="btn btn-primary btn-lg" style={{ flex: 1 }} type="button" onClick={onNouvelle}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          Nouvelle commande
        </button>
        {/* Absent là où le navigateur ne sait pas dicter : mieux vaut pas de
            bouton qu'un bouton qui échoue. */}
        {onDicter && (
          <button className="btn btn-lg mic" type="button" onClick={onDicter} aria-label="Dicter la commande">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="2.5" width="6" height="11" rx="3" fill="currentColor" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="content">
        <div className="inner">
          <Anomalie etat={etatSync} />
          {commandes.length === 0 ? (
            <div className="empty">
              <div className="big">🔥</div>
              <h2>Le grill est libre</h2>
              <p>
                Les commandes envoyées s’affichent ici, de la plus ancienne à la plus récente,
                avec le temps écoulé depuis la prise.
              </p>
            </div>
          ) : (
            <div className="orders">
              {commandes.map((cmd) => (
                <Commande key={cmd.id} cmd={cmd} maintenant={maintenant} onServir={onServir} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
