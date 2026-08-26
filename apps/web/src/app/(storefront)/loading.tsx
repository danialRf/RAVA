export default function Loading() {
  return (
    <div className="section-shell loading-page" aria-label="در حال بارگذاری">
      <div className="skeleton skeleton-title" />
      <div className="skeleton-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <div className="skeleton skeleton-image" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
          </div>
        ))}
      </div>
    </div>
  );
}
