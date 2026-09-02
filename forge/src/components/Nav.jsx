const ONGLETS = [
  { id: 'accueil', nom: 'Accueil', d: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { id: 'jeune', nom: 'Jeûne', d: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm.8-13h-1.6v5.3l4.5 2.7.8-1.3-3.7-2.2z' },
  { id: 'sport', nom: 'Sport', d: 'M20.6 5.6l-2.2-2.2-1.4 1.4 1.4 1.4-8.4 8.4-1.4-1.4-1.4 1.4 1.4 1.4-1.4 1.4 1.4 1.4 1.4-1.4 1.4 1.4 1.4-1.4-1.4-1.4 8.4-8.4 1.4 1.4 1.4-1.4-1.4-1.4 1.4-1.4zM5 15.5l-1.4 1.4L2.2 15.5 3.6 14.1zm14-7L17.6 7.1 19 5.7l1.4 1.4z' },
  { id: 'courbes', nom: 'Courbes', d: 'M3 17l6-6 4 4 8-8v3l-8 8-4-4-6 6zM3 21h18v-2H3z' },
  { id: 'profil', nom: 'Profil', d: 'M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5z' },
];

export default function Nav({ onglet, onChange }) {
  return (
    <nav className="nav" aria-label="Navigation principale">
      {ONGLETS.map((o) => (
        <button key={o.id} type="button" className={onglet === o.id ? 'on' : ''} onClick={() => onChange(o.id)} aria-current={onglet === o.id ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={o.d} fill="currentColor" /></svg>
          {o.nom}
        </button>
      ))}
    </nav>
  );
}
