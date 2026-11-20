import './Button.scss';

export function Button({ variant = 'primary', size, grow, className = '', type = 'button', ...props }) {
  const classes = ['btn', `btn--${variant}`, size && `btn--${size}`, grow && 'btn--grow', className];
  return <button type={type} className={classes.filter(Boolean).join(' ')} {...props} />;
}
