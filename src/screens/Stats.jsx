import { useEffect, useMemo, useState } from 'react';
import { toutesLesCommandes } from '../db.js';
import { calculer } from '../lib/stats.js';
import { debutDeJournee, formatDuree, ilYaNJours } from '../lib/temps.js';

const PERIODES = [
  { id: 'jour', libelle: "Aujourd'hui", depuis: () => debutDeJournee() },
  { id: 's7', libelle: '7 jours', depuis: () => ilYaNJours(6) },
  { id: 'j30', libelle: '30 jours', depuis: () => ilYaNJours(29) },
  { id: 'tout', libelle: 'Tout', depuis: () => 0 },
];

const nf = new Intl.NumberFormat('fr-FR');
const pct = (x) => `${Math.round(x * 100)} %`;

/** Tuile de statistique : le chiffre est la donnée, pas un graphique à une barre. */
function Tuile({ cle, valeur, unite }) {
  return (
    <div className="kpi">
      <div className="k">{cle}</div>
      <div className="v">
        {valeur}
        {unite && <small> {unite}</small>}
      </div>
    </div>
  );
}

/**
 * Répartition des cuissons : une barre empilée (part d'un tout), doublée d'une
 * liste chiffrée. Les segments portent chacun leur libellé en clair — c'est ce
 * qui rend la lecture possible sans distinguer les couleurs.
 */
function Cuissons({ repartition, total }) {
  if (!total) return <p className="lede">Aucune pièce avec cuisson sur la période.</p>;
  return (
    <>
      <div className="stack" role="img" aria-label={
        `Répartition des cuissons : ${repartition.map((c) => `${c.nom} ${pct(c.part)}`).join(', ')}`
      }>
        {repartition.map((c) => (
          <div
            key={c.id}
            className="stack-seg"
            style={{ width: `${c.part * 100}%`, background: c.couleur }}
            title={`${c.nom} — ${nf.format(c.n)} pièces (${pct(c.part)})`}
          />
        ))}
      </div>
      <ul className="bars" style={{ marginTop: 16 }}>
        {repartition.map((c) => (
          <li className="bar-row" key={c.id}>
            <span className="lbl">
              <i className="swatch" style={{ background: c.couleur }} aria-hidden="true" />
              {c.nom}
            </span>
            <span className="val">
              {nf.format(c.n)} <em>{pct(c.part)}</em>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Classement des grillades : une seule mesure, donc une seule couleur. */
function Classement({ lignes, max }) {
  if (!lignes.length) return <p className="lede">Aucune pièce sur la période.</p>;
  return (
    <ul className="bars">
      {lignes.map((g) => (
        <li className="bar-row" key={g.id}>
          <span className="lbl">{g.nom}</span>
          <span className="val">{nf.format(g.n)}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${max ? (g.n / max) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Activité par heure : une mesure dans le temps, une couleur, pas de légende. */
function Heures({ parHeure }) {
  const max = Math.max(...parHeure);
  if (!max) return <p className="lede">Aucune commande sur la période.</p>;
  // On ne montre que l'amplitude réellement travaillée, pas 24 colonnes vides.
  const premiere = parHeure.findIndex((n) => n > 0);
  const derniere = parHeure.length - 1 - [...parHeure].reverse().findIndex((n) => n > 0);
  const plage = [];
  for (let h = premiere; h <= derniere; h++) plage.push(h);

  return (
    <div className="hours" role="img" aria-label={
      `Pièces par heure : ${plage.map((h) => `${h} h, ${parHeure[h]}`).join(' ; ')}`
    }>
      {plage.map((h) => (
        <div className="hour" key={h}>
          <div className="zone">
            <div
              className={`col ${parHeure[h] ? '' : 'nil'}`}
              style={{ height: `${Math.max(3, (parHeure[h] / max) * 100)}%` }}
              title={`${h} h — ${nf.format(parHeure[h])} pièce${parHeure[h] > 1 ? 's' : ''}`}
            />
          </div>
          <span className="h">{h}</span>
        </div>
      ))}
    </div>
  );
}

/** Vue tableau : l'équivalent lisible sans aucune couleur. */
function Tableau({ s }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <caption>Pièces par grillade et par cuisson</caption>
        <thead>
          <tr><th scope="col">Grillade</th><th scope="col">Pièces</th></tr>
        </thead>
        <tbody>
          {s.classementGrillades.map((g) => (
            <tr key={g.id}><th scope="row">{g.nom}</th><td className="tabular">{nf.format(g.n)}</td></tr>
          ))}
        </tbody>
      </table>

      <table className="data">
        <thead>
          <tr><th scope="col">Cuisson</th><th scope="col">Pièces</th><th scope="col">Part</th></tr>
        </thead>
        <tbody>
          {s.repartitionCuissons.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.nom}</th>
              <td className="tabular">{nf.format(c.n)}</td>
              <td className="tabular">{pct(c.part)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {s.tables.length > 0 && (
        <table className="data">
          <thead>
            <tr><th scope="col">Table</th><th scope="col">Pièces</th></tr>
          </thead>
          <tbody>
            {s.tables.slice(0, 12).map((t) => (
              <tr key={t.table}><th scope="row">Table {t.table}</th><td className="tabular">{nf.format(t.n)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Stats({ commandesEnCours, onRetour }) {
  const [periode, setPeriode] = useState('jour');
  const [historique, setHistorique] = useState(null);
  const [vueTableau, setVueTableau] = useState(false);

  // L'historique n'est lu qu'ici : l'accueil n'a besoin que des commandes en cours.
  useEffect(() => {
    let vivant = true;
    toutesLesCommandes().then((tout) => { if (vivant) setHistorique(tout); });
    return () => { vivant = false; };
  }, []);

  const s = useMemo(() => {
    if (!historique) return null;
    const depuis = PERIODES.find((p) => p.id === periode).depuis();
    // L'historique contient déjà les commandes en cours : pas de doublon à craindre.
    return calculer(historique.filter((c) => c.creeeA >= depuis));
  }, [historique, periode]);

  const maxGrillade = s?.classementGrillades[0]?.n || 0;

  return (
    <>
      <header className="topbar">
        <button className="btn btn-quiet btn-icon" type="button" onClick={onRetour} aria-label="Retour">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="title">
          Statistiques
          <span className="sub">
            {commandesEnCours.length
              ? `${commandesEnCours.length} commande${commandesEnCours.length > 1 ? 's' : ''} encore en cours`
              : 'Service terminé'}
          </span>
        </h1>
        <button
          className="btn btn-ghost btn-icon"
          type="button"
          onClick={() => setVueTableau((v) => !v)}
          aria-pressed={vueTableau}
          aria-label={vueTableau ? 'Voir les graphiques' : 'Voir le tableau'}
          title={vueTableau ? 'Voir les graphiques' : 'Voir le tableau'}
        >
          {vueTableau ? '▤' : '☰'}
        </button>
      </header>

      <div className="content">
        <div className="inner">
          {/* Un seul filtre, au-dessus de tout ce qu'il concerne. */}
          <div className="seg" role="group" aria-label="Période">
            {PERIODES.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={periode === p.id}
                onClick={() => setPeriode(p.id)}
              >
                {p.libelle}
              </button>
            ))}
          </div>

          {!s ? (
            <div className="empty"><p>Lecture de l’historique…</p></div>
          ) : s.nbCommandes === 0 ? (
            <div className="empty">
              <div className="big">📊</div>
              <h2>Rien à afficher</h2>
              <p>Aucune commande sur cette période. Les statistiques se remplissent au fil du service.</p>
            </div>
          ) : (
            <>
              <div className="kpis">
                <Tuile cle="Commandes" valeur={nf.format(s.nbCommandes)} />
                <Tuile cle="Pièces" valeur={nf.format(s.pieces)} />
                <Tuile
                  cle="Par commande"
                  valeur={s.moyenneParCommande.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
                  unite="pièces"
                />
                <Tuile
                  cle="Temps de service"
                  valeur={s.nbServies ? formatDuree(s.dureeMoyenne) : '—'}
                />
              </div>

              {vueTableau ? (
                <div className="panel">
                  <h2>Tableau des chiffres</h2>
                  <p className="lede">Les mêmes données, sans dépendre des couleurs.</p>
                  <Tableau s={s} />
                </div>
              ) : (
                <>
                  <section className="panel">
                    <h2>Cuissons les plus demandées</h2>
                    <p className="lede">
                      Part de chaque cuisson sur {nf.format(s.piecesAvecCuisson)} pièce
                      {s.piecesAvecCuisson > 1 ? 's' : ''} concernée{s.piecesAvecCuisson > 1 ? 's' : ''}.
                    </p>
                    <Cuissons repartition={s.repartitionCuissons} total={s.piecesAvecCuisson} />
                  </section>

                  <section className="panel">
                    <h2>Grillades les plus servies</h2>
                    <p className="lede">Nombre de pièces, de la plus demandée à la moins demandée.</p>
                    <Classement lignes={s.classementGrillades} max={maxGrillade} />
                  </section>

                  <section className="panel">
                    <h2>Activité par heure</h2>
                    <p className="lede">
                      Pièces commandées par tranche horaire.
                      {s.heurePointe !== null && ` Le coup de feu tombe vers ${s.heurePointe} h.`}
                    </p>
                    <Heures parHeure={s.parHeure} />
                  </section>

                  {s.tables.length > 1 && (
                    <section className="panel">
                      <h2>Tables les plus servies</h2>
                      <p className="lede">Pièces commandées par table.</p>
                      <Classement
                        lignes={s.tables.slice(0, 8).map((t) => ({ id: t.table, nom: `Table ${t.table}`, n: t.n }))}
                        max={s.tables[0].n}
                      />
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
