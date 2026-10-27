export function Button({
  variant = "primary",
  children,
  className,
  ...props
}) {
  const styles = {
    primary: { backgroundColor: "var(--color-primary)", color: "white" },
    secondary: {
      backgroundColor: "var(--color-border)",
      color: "var(--color-fg)",
    },
  };

  return (
    <button
      style={{
        padding: "8px 16px",
        borderRadius: "8px",
        fontWeight: 500,
        border: "none",
        cursor: "pointer",
        ...styles[variant],
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}
