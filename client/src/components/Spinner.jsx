import './Spinner.scss';

export function Spinner({ small = false, className = '' }) {
  return <span className={`spinner ${small ? 'spinner--small' : ''} ${className}`} role="status" aria-label="Loading" />;
}
