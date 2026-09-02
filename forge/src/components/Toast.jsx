export default function Toast({ texte, xp, action, onFermer }) {
  return (
    <div className={`toast${xp ? ' xp' : ''}`} role="status" aria-live="polite">
      <span>{xp ? <b>+{xp} XP</b> : null}{texte}</span>
      {action && (
        <button className="btn btn-primary" type="button" onClick={() => { onFermer(); action.faire(); }}>
          {action.libelle}
        </button>
      )}
    </div>
  );
}
