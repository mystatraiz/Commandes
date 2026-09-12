import { useState } from 'react';
import Feuille from '../components/Feuille.jsx';
import Anneau from '../components/Anneau.jsx';
import CourbesDefi from '../components/CourbesDefi.jsx';
import Fil from '../components/Fil.jsx';
import {
  statutDefi, STATUTS, joursRestants, joursTotal, progressionTemps,
  mesureById, formatValeur, ecartAuDessus, VISIBILITES, VISIBILITE_DEFAUT,
} from '../lib/defis.js';
import { formatDateCourte, formatJourMois } from '../lib/temps.js';

const MEDAILLES = { 1: '🥇', 2: '🥈', 3: '🥉' };

/* L'autre unité que celle qui classe : le pourcentage met les gabarits à
   égalité, mais ce sont les kilos qui parlent. On montre les deux. */
function secondaire(p, mesure) {
  const v = mesure === 'kilos' ? p.pct : p.kg;
  if (v === null || v === undefined) return '';
  return `${v.toLocaleString('fr-FR')} ${mesure === 'kilos' ? '%' : 'kg'}`;
}

function Ligne({ p, mesure }) {
  const chiffre = p.visibilite === 'rang' && !p.moi ? null : p.valeur;
  return (
    <div className={`ligne${p.moi ? ' moi' : ''}`}>
      <div className="rang">{p.rang ? (MEDAILLES[p.rang] || p.rang) : '—'}</div>
      <div className="ico">{p.emoji}</div>
      <div className="txt">
        <div className="t">{p.pseudo}{p.moi ? ' · toi' : ''}</div>
        <div className="d">
          {p.rang === null
            ? 'pas encore pesé'
            : p.visibilite === 'rang' && !p.moi
              ? 'ne montre que son rang'
              : secondaire(p, mesure)}
        </div>
      </div>
      <div className="v tabular">{chiffre === null || chiffre === undefined ? '—' : formatValeur(chiffre, mesure)}</div>
    </div>
  );
}

export default function Arene({
  defi, classement, evenements = [], monProgres, chargement, erreur, depuisCache, maintenant,
  onRetour, onRafraichir, onVisibilite, onQuitter, onClore, onPeser,
  onReagir, onCommenter, onSupprimerCommentaire,
}) {
  const [feuille, setFeuille] = useState(null);
  const [copie, setCopie] = useState(false);

  const statut = statutDefi(defi, maintenant);
  const restants = joursRestants(defi, maintenant);
  const mesure = defi.mesure;
  const moi = classement.find((p) => p.moi) || null;
  const ecart = moi ? ecartAuDessus(classement, moi.userId) : null;
  const premier = classement.find((p) => p.rang === 1) || null;
  // Qui ne publie que son rang n'a pas de courbe : autant le dire, sinon on
  // cherche pourquoi il manque quelqu'un sur le graphique.
  const discrets = classement.filter((p) => p.visibilite === 'rang' && !p.moi);
  const visibilite = defi.participation?.visibilite || VISIBILITE_DEFAUT;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(defi.code);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch { setCopie(false); }
  };

  return (
    <div className="ecran">
      <header className="topbar">
        <button className="btn btn-ghost btn-icon" type="button" onClick={onRetour} aria-label="Retour">←</button>
        <div className="titre">
          <h1>{defi.nom}</h1>
          <span className="sous">
            {STATUTS[statut].nom} · {mesureById(mesure).nom} · du {formatJourMois(defi.debut)} au {formatJourMois(defi.fin)}
          </span>
        </div>
        <button className="btn btn-ghost btn-icon" type="button" onClick={() => setFeuille('reglages')} aria-label="Réglages du défi">⋯</button>
      </header>

      <div className="contenu avec-nav">
        <section className="carte">
          <div className="carte-tete">
            <span className="eyebrow">Où en est tout le monde</span>
            <span className="aide">{mesureById(mesure).court} perdu</span>
          </div>
          <CourbesDefi evenements={evenements} classement={classement} mesure={mesure} />
        </section>

        {discrets.length > 0 && (
          <div className="rappel">
            <b>{discrets.map((p) => p.pseudo).join(', ')} ne montre{discrets.length > 1 ? 'nt' : ''} que son rang.</b>{' '}
            C’est tout ce qui sort de son téléphone : ni courbe, ni chiffre. Chacun règle ça de son
            côté, dans les réglages du défi — et le poids réel ne quitte jamais l’appareil, quel que
            soit le réglage.
          </div>
        )}

        {statut === 'termine' && premier && (
          <section className="carte hero feu">
            <div className="rayures" />
            <div className="carte-tete"><span className="eyebrow feu">Palmarès</span></div>
            <div className="vainqueur">
              <div className="emoji-geant">{premier.emoji}</div>
              <div>
                <div className="display" style={{ fontSize: 30 }}>{premier.pseudo}</div>
                <div className="soft">{premier.moi ? 'Tu as gagné.' : 'l’emporte'} · {formatValeur(premier.valeur, mesure)}</div>
              </div>
            </div>
            {defi.gage && <p className="punchline" style={{ marginTop: 12 }}>{defi.gage}</p>}
          </section>
        )}

        {statut !== 'termine' && (
          <section className={`carte hero${statut === 'a_venir' ? ' acier' : ''}`}>
            <div className="rayures" />
            <div className="carte-tete">
              <span className="eyebrow">{statut === 'a_venir' ? 'Départ' : 'Ta place'}</span>
            </div>
            {statut === 'a_venir' ? (
              <>
                <h2 className="titre-carte">Ça commence le {formatDateCourte(defi.debut)}</h2>
                <p className="soft" style={{ fontSize: 13, marginTop: 6 }}>
                  Pèse-toi d’ici là : c’est ta dernière pesée avant le départ qui sert de référence.
                </p>
              </>
            ) : (
              <div className="rangee" style={{ alignItems: 'center' }}>
                <Anneau valeur={progressionTemps(defi, maintenant)} taille={112} epaisseur={10}
                  couleur={moi?.rang === 1 ? 'var(--lime)' : 'var(--acier)'}>
                  <div className="chiffre md tabular" style={{ fontSize: 26 }}>
                    {moi?.rang ? `${moi.rang}` : '—'}
                    <small>/ {classement.length}</small>
                  </div>
                </Anneau>
                <div style={{ flex: 2 }}>
                  <div className="chiffre lg tabular" style={{ fontSize: 34 }}>
                    {formatValeur(moi?.valeur, mesure)}
                  </div>
                  <div className="soft" style={{ fontSize: 13, marginTop: 4 }}>
                    {restants} jour{restants > 1 ? 's' : ''} restant{restants > 1 ? 's' : ''} sur {joursTotal(defi)}
                  </div>
                  {ecart !== null && ecart > 0 && (
                    <div className="feu" style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                      {formatValeur(ecart, mesure)} pour passer devant
                    </div>
                  )}
                  {moi?.rang === 1 && <div className="lime" style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>Tu mènes. Tiens bon.</div>}
                </div>
              </div>
            )}
            {monProgres?.departEstime && (
              <p className="aide" style={{ marginTop: 10 }}>
                Départ estimé sur ta première pesée de la période : tu n’avais pas de pesée avant le début.
              </p>
            )}
            {!monProgres && (
              <button className="btn btn-primary btn-block" type="button" style={{ marginTop: 12 }} onClick={onPeser}>
                Poser ma pesée de départ
              </button>
            )}
          </section>
        )}

        {erreur && (
          <div className="anomalie" role="alert">
            <strong>Classement pas à jour.</strong>{erreur}
            {depuisCache && <span className="note">Voici le dernier connu.</span>}
          </div>
        )}

        <section>
          <div className="carte-tete">
            <span className="eyebrow">Classement</span>
            <button className="btn btn-quiet btn-sm" type="button" onClick={onRafraichir} disabled={chargement}>
              {chargement ? '…' : '↻'}
            </button>
          </div>
          {classement.length === 0 ? (
            <p className="aide centre-texte">Personne n’a encore posé de pesée.</p>
          ) : (
            <div className="liste classement">
              {classement.map((p) => <Ligne key={p.userId} p={p} mesure={mesure} />)}
            </div>
          )}
        </section>

        <section>
          <div className="carte-tete">
            <span className="eyebrow acier">Le fil</span>
            <span className="aide">appuie sur une phrase pour l’envoyer</span>
          </div>
          <Fil
            evenements={evenements} maintenant={maintenant}
            onReagir={onReagir} onCommenter={onCommenter} onSupprimerCommentaire={onSupprimerCommentaire}
          />
        </section>

        {statut !== 'termine' && (
          <section className="carte">
            <div className="carte-tete"><span className="eyebrow acier">Inviter</span></div>
            <p className="aide" style={{ marginBottom: 8 }}>Envoie ce code à qui tu veux voir dans la course.</p>
            <button className="code-partage" type="button" onClick={copier}>
              <span className="code-valeur tabular">{defi.code}</span>
              <span className="code-action">{copie ? 'Copié ✓' : 'Copier'}</span>
            </button>
          </section>
        )}

        {defi.gage && statut !== 'termine' && (
          <section className="carte">
            <div className="carte-tete"><span className="eyebrow feu">Le gage</span></div>
            <p className="punchline" style={{ fontSize: 17 }}>{defi.gage}</p>
          </section>
        )}
      </div>

      {feuille === 'reglages' && (
        <Feuille titre="Ce défi" onFermer={() => setFeuille(null)}>
          <div className="champ-groupe">
            <label>Ce que les autres voient de toi</label>
            <div className="puces" role="radiogroup" aria-label="Visibilité">
              {VISIBILITES.map((v) => (
                <button key={v.id} type="button" role="radio" aria-checked={visibilite === v.id}
                  className={`puce${visibilite === v.id ? ' on acier' : ''}`}
                  onClick={() => onVisibilite(v.id)}>{v.nom}</button>
              ))}
            </div>
            <span className="aide">
              {VISIBILITES.find((v) => v.id === visibilite)?.detail} Ton poids, lui, ne sort jamais.
            </span>
          </div>
          <div className="sep" />
          {defi.estCreateur && !defi.clos && statut === 'termine' && (
            <button className="btn btn-ghost btn-block" type="button" onClick={() => { onClore(); setFeuille(null); }}>
              Clore le défi
            </button>
          )}
          <button className="btn btn-danger btn-block" type="button" onClick={() => { onQuitter(); setFeuille(null); }}>
            Quitter ce défi
          </button>
          <span className="aide">Quitter efface ta participation et ton classement. Tes pesées restent.</span>
        </Feuille>
      )}
    </div>
  );
}
