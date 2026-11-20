import './Panel.scss';

export function Panel({ padded = false, className = '', ...props }) {
  return <div className={`panel ${padded ? 'panel--padded' : ''} ${className}`} {...props} />;
}
