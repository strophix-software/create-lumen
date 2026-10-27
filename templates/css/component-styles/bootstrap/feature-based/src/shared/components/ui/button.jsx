export function Button({
  variant = "primary",
  children,
  className,
  ...props
}) {
  const variants = {
    primary: "btn btn-primary",
    secondary: "btn btn-secondary",
  };

  return (
    <button className={`${variants[variant]} ${className ?? ""}`} {...props}>
      {children}
    </button>
  );
}