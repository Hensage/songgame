import { useState } from 'react';
import { Button } from './Button.jsx';
import './ToggleSection.scss';

/** A button that reveals or hides its children. */
export function ToggleSection({ label, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="toggle-section">
      <Button aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {label}
      </Button>
      {open && <div className="toggle-section__content">{children}</div>}
    </div>
  );
}
