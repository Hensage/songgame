import { WarningCircle } from '@phosphor-icons/react';
import './Alert.scss';

export function Alert({ children }) {
  return (
    <div className="alert" role="alert">
      <WarningCircle size={20} weight="bold" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
