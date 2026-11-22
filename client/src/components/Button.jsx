import './Button.scss';

/**
 * `variant`: "primary" (green, one main action per screen), "secondary" (white),
 * "outline" (quiet, for toggles) or "icon" (bare 48px glyph button).
 * `size="small"` is the 32px pill; `round` makes a 48px circle for a single icon.
 *
 * Pass `icon` (a Phosphor icon component) along with a text label to let the button
 * collapse to just the icon when the page is squashed (see the container query in
 * Button.scss). The label then becomes the button's accessible name.
 */
export function Button({
  variant = 'primary',
  size,
  round,
  grow,
  icon: Icon,
  className = '',
  type = 'button',
  children,
  ...props
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size && `btn--${size}`,
    round && 'btn--round',
    grow && 'btn--grow',
    Icon && 'btn--has-icon',
    className,
  ];

  return (
    <button
      type={type}
      className={classes.filter(Boolean).join(' ')}
      aria-label={Icon && typeof children === 'string' ? children : undefined}
      {...props}
    >
      {Icon ? (
        <>
          <Icon className="btn__icon" size={size === 'small' ? 18 : 22} weight="bold" aria-hidden="true" />
          <span className="btn__label">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
