interface AlertProps {
  message: string;
  variant?: 'error' | 'info';
}

export function Alert({ message, variant = 'error' }: AlertProps) {
  return <div className={`alert alert-${variant}`}>{message}</div>;
}
