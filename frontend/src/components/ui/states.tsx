export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="state-block state-loading">{label}</div>;
}

export function ErrorState({ message = 'Something went wrong.' }: { message?: string }) {
  return <div className="state-block state-error">{message}</div>;
}

export function EmptyState({ message = 'Nothing to show yet.' }: { message?: string }) {
  return <div className="state-block state-empty">{message}</div>;
}
