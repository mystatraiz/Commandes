export default function Toast({ texte, action, onFermer }) {
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{texte}</span>
      {action && (
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => { onFermer(); action.faire(); }}
        >
          {action.libelle}
        </button>
      )}
    </div>
  );
}
