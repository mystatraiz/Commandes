/* Barre de navigation. Les icônes sont dessinées à la main plutôt que tirées
   d'une police : cinq formes simples, lisibles à 22 px sur fond sombre. */

const ONGLETS = [
  {
    id: 'accueil', nom: 'Accueil',
    forme: <path d="M3 11.4 12 3.8l9 7.6V20a1.2 1.2 0 0 1-1.2 1.2h-4.6v-6.1H8.8v6.1H4.2A1.2 1.2 0 0 1 3 20z" />,
  },
  {
    id: 'jeune', nom: 'Jeûne',
    forme: (
      <>
        <path d="M12 2.6a9.4 9.4 0 1 0 9.4 9.4A9.4 9.4 0 0 0 12 2.6zm0 2.2a7.2 7.2 0 1 1-7.2 7.2A7.2 7.2 0 0 1 12 4.8z" />
        <path d="M12.9 6.9h-2v5.7l4.4 2.6 1-1.7-3.4-2z" />
      </>
    ),
  },
  {
    id: 'sport', nom: 'Sport',
    // Haltère : deux disques par côté, barre au milieu.
    forme: (
      <>
        <rect x="2" y="9.2" width="2.6" height="5.6" rx="1.1" />
        <rect x="5.4" y="6.6" width="3.4" height="10.8" rx="1.5" />
        <rect x="8.4" y="10.4" width="7.2" height="3.2" rx="1.1" />
        <rect x="15.2" y="6.6" width="3.4" height="10.8" rx="1.5" />
        <rect x="19.4" y="9.2" width="2.6" height="5.6" rx="1.1" />
      </>
    ),
  },
  {
    id: 'courbes', nom: 'Courbes',
    forme: (
      <>
        <path d="M3.6 16.6 9 11.2l3.6 3.6 7-7v3.1l-7 7L9 14.3l-5.4 5.4z" />
        <rect x="3" y="20.4" width="18" height="1.8" rx="0.9" />
      </>
    ),
  },
  {
    id: 'profil', nom: 'Profil',
    forme: (
      <>
        <circle cx="12" cy="7.6" r="4.6" />
        <path d="M12 14c-4.3 0-7.8 2.2-7.8 5v2.2h15.6V19c0-2.8-3.5-5-7.8-5z" />
      </>
    ),
  },
];

export default function Nav({ onglet, onChange }) {
  return (
    <nav className="nav" aria-label="Navigation principale">
      {ONGLETS.map((o) => (
        <button
          key={o.id}
          type="button"
          className={onglet === o.id ? 'on' : ''}
          onClick={() => onChange(o.id)}
          aria-current={onglet === o.id ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{o.forme}</svg>
          {o.nom}
        </button>
      ))}
    </nav>
  );
}
