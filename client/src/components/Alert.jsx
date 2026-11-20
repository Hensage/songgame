import './Alert.scss';

export function Alert({ children }) {
  return (
    <div className="alert" role="alert">
      {children}
    </div>
  );
}
