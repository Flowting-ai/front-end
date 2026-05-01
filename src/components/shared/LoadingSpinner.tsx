export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `2px solid var(--neutral-200)`,
          borderTopColor: "var(--neutral-600)",
          animation: "kaya-spin 0.7s linear infinite",
        }}
      />
    </div>
  );
}

export function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        minHeight: "200px",
      }}
    >
      <LoadingSpinner size={28} />
    </div>
  );
}
