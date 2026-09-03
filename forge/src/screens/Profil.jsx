import { useEffect, useState } from 'react';
import { OBJECTIFS_JEUNE } from '../lib/jeune.js';
import { syncActive, COMPTE } from '../supabase.js';

/*
  Relevé de la géométrie réelle de l'écran.

  Les marges d'écran annoncées par iOS ne se reproduisent sur aucun navigateur
  de bureau : sans mesure prise sur l'appareil, on ne peut que supposer pourquoi
  la barre du bas ne tombe pas où elle devrait. Ces quelques nombres disent en
  une ligne si la page occupe tout l'écran, quelle marge basse le système
  annonce, et où la barre atterrit vraiment.
*/
function useGeometrie() {
  const [g, setG] = useState(null);
  useEffect(() => {
    const mesurer = () => {
      const nav = document.querySelector('.nav');
      const boite = nav?.getBoundingClientRect();
      const style = nav ? getComputedStyle(nav) : null;
      setG({
        ecran: window.screen?.height ?? 0,
        vue: Math.round(window.innerHeight),
        visuelle: Math.round(window.visualViewport?.height ?? 0),
        barre: style ? Math.round(parseFloat(style.height)) : null,
        marge: style ? Math.round(parseFloat(style.paddingBottom)) : null,
        sousBarre: boite ? Math.round(window.innerHeight - boite.bottom) : null,
        plein: window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
        dpr: window.devicePixelRatio,
      });
    };
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, []);
  return g;
}

function Anomalie({ etat }) {
  if (!etat?.actif || !etat.erreur) return null;
  const tableAbsente = /forge_entrees|does not exist|schema cache/i.test(etat.erreur);
  return (
    <div className="anomalie" role="alert">
      <strong>La synchronisation ne fonctionne pas.</strong>
      {tableAbsente ? 'La table n’existe pas encore : lance supabase/schema.sql dans le SQL Editor de Supabase.' : etat.erreur}
    </div>
  );
}

export default function Profil({ resume, reglages, etatSync, onMajReglages, onDeconnecter, onExporter }) {
  const { niveau, serie, badges, nbBadges, journeesParfaites } = resume;
  const geo = useGeometrie();
  const [form, setForm] = useState({
    prenom: reglages.prenom || '',
    objectifPoids: reglages.objectifPoids ?? '',
    objectifJeuneH: reglages.objectifJeuneH || 16,
    objectifSessions: reglages.objectifSessions || 3,
    poidsRef: reglages.poidsRef || 80,
  });
  const [sauve, setSauve] = useState(false);
  const poser = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSauve(false); };
  const enregistrer = (e) => {
    e.preventDefault();
    onMajReglages({
      prenom: form.prenom.trim(),
      objectifPoids: form.objectifPoids === '' ? null : Number(String(form.objectifPoids).replace(',', '.')) || null,
      objectifJeuneH: Number(form.objectifJeuneH) || 16,
      objectifSessions: Math.max(1, Math.min(14, Number(form.objectifSessions) || 3)),
      poidsRef: Number(String(form.poidsRef).replace(',', '.')) || 80,
    });
    setSauve(true);
  };

  return (
    <div className="ecran">
      <header className="topbar">
        <div className="titre"><h1>Profil</h1><span className="sous">Niveau {niveau.n} · {niveau.nom}</span></div>
      </header>
      <div className="contenu avec-nav">
        <section className="carte hero">
          <div className="rayures" />
          <div className="niveau">
            <div className="badge-niveau">{niveau.n}</div>
            <div className="info">
              <div className="nom">{niveau.nom}</div>
              <div className="xp tabular">{niveau.xp.toLocaleString('fr-FR')} XP · encore {(niveau.pourSuivant - niveau.dansNiveau).toLocaleString('fr-FR')} pour {niveau.n + 1}</div>
              <div className="jauge"><i style={{ width: `${Math.round(niveau.progression * 100)}%` }} /></div>
            </div>
          </div>
          <div className="tuiles" style={{ marginTop: 14 }}>
            <div className="tuile"><div className="k">Série</div><div className="v">{serie.courante}<small>j</small></div><div className="d">record {serie.record} j</div></div>
            <div className="tuile"><div className="k">Jours actifs</div><div className="v">{serie.joursActifs}</div><div className="d">{journeesParfaites} parfait{journeesParfaites > 1 ? 's' : ''}</div></div>
          </div>
        </section>

        <section>
          <div className="carte-tete"><span className="eyebrow">Succès</span><span className="chiffre md tabular" style={{ fontSize: 20 }}>{nbBadges}<small>/ {badges.length}</small></span></div>
          <div className="badges">
            {badges.map((b) => (
              <div className={`badge${b.obtenu ? ' obtenu' : ''}`} key={b.id} title={b.detail}>
                <div className="i" aria-hidden="true">{b.icone}</div>
                <div className="n">{b.nom}</div>
                <div className="p"><i style={{ width: `${Math.round(b.progres * 100)}%` }} /></div>
                <span className="sr">{b.detail} {b.obtenu ? 'obtenu' : `${Math.round(b.progres * 100)} %`}</span>
              </div>
            ))}
          </div>
        </section>

        <form className="carte" onSubmit={enregistrer}>
          <div className="carte-tete"><span className="eyebrow acier">Réglages</span></div>
          <div className="champ-groupe"><label htmlFor="prenom">Prénom</label><input id="prenom" className="champ" value={form.prenom} onChange={(e) => poser('prenom', e.target.value)} placeholder="Comment on t’appelle ?" /></div>
          <div className="rangee" style={{ marginTop: 12 }}>
            <div className="champ-groupe"><label htmlFor="obj-poids">Objectif poids (kg)</label><input id="obj-poids" className="champ" inputMode="decimal" value={form.objectifPoids} onChange={(e) => poser('objectifPoids', e.target.value)} placeholder="—" /></div>
            <div className="champ-groupe"><label htmlFor="poids-ref">Poids de référence</label><input id="poids-ref" className="champ" inputMode="decimal" value={form.poidsRef} onChange={(e) => poser('poidsRef', e.target.value)} /></div>
          </div>
          <div className="rangee" style={{ marginTop: 12 }}>
            <div className="champ-groupe">
              <label htmlFor="obj-jeune">Jeûne par défaut</label>
              <select id="obj-jeune" className="champ" value={form.objectifJeuneH} onChange={(e) => poser('objectifJeuneH', e.target.value)}>
                {OBJECTIFS_JEUNE.map((o) => <option key={o.h} value={o.h}>{o.h} h · {o.nom}</option>)}
              </select>
            </div>
            <div className="champ-groupe"><label htmlFor="obj-sessions">Sessions / semaine</label><input id="obj-sessions" className="champ" inputMode="numeric" value={form.objectifSessions} onChange={(e) => poser('objectifSessions', e.target.value)} /></div>
          </div>
          <span className="aide" style={{ display: 'block', marginTop: 8 }}>Le poids de référence sert à estimer les calories d’un circuit quand la montre n’a rien dit.</span>
          <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 14 }}>{sauve ? 'Enregistré ✓' : 'Enregistrer'}</button>
        </form>

        <section className="carte">
          <div className="carte-tete"><span className="eyebrow">Données</span></div>
          <Anomalie etat={etatSync} />
          <p className="aide" style={{ margin: '6px 0 12px' }}>
            {syncActive
              ? `Synchronisées avec Supabase (${COMPTE}). ${etatSync.connecte ? 'Connecté.' : 'Hors ligne : tout est gardé sur l’appareil et partira au retour du réseau.'}`
              : 'Conservées sur cet appareil uniquement : la synchronisation Supabase n’est pas configurée.'}
          </p>
          <div className="rangee">
            <button className="btn btn-ghost" type="button" onClick={onExporter}>Exporter (JSON)</button>
            {syncActive && <button className="btn btn-danger" type="button" onClick={onDeconnecter}>Déconnexion</button>}
          </div>
          {/* Repère de version : dit d'un coup d'œil si le téléphone tourne
              bien sur la dernière mise en ligne. */}
          <p className="aide version" style={{ marginTop: 12 }}>Version du {__BUILD__}</p>
          {geo && (
            <p className="aide geometrie">
              écran {geo.ecran} · vue {geo.vue} · visuelle {geo.visuelle} · barre {geo.barre}
              {' '}(marge {geo.marge}) · sous barre {geo.sousBarre} · {geo.plein ? 'plein écran' : 'navigateur'} · ×{geo.dpr}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
