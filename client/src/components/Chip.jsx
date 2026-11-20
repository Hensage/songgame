import './Chip.scss';

/** A toggleable pill, used for quick picks. */
export function Chip({ selected, disabled = false, onClick, children }) {
  return (
    <button type="button" className="chip" aria-pressed={selected} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
