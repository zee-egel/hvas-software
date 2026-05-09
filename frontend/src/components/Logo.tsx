const logoSrc = import.meta.env.DEV
  ? "http://localhost:5000/static/images/hvas-logo.png"
  : "/static/images/hvas-logo.png";

export default function Logo({
  className = "h-20 w-auto",
}: {
  className?: string;
}) {
  return (
    <img
      src={logoSrc}
      alt="HVAS logo"
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}
