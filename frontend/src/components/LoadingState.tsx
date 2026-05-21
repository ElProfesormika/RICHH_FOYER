export function LoadingState({ label = "Chargement en cours" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <div className="loading-spinner" />
      <p>{label}</p>
    </div>
  );
}
