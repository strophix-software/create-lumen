interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  children,
  className,
  ...props
}: ButtonProps) {
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