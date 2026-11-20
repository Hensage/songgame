import './ProgressBar.scss';

export function ProgressBar({ percent, label }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
      <div className="progress__bar" style={{ width: `${percent}%` }}>
        <span className="progress__label">{label}</span>
      </div>
    </div>
  );
}
