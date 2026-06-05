const logoSrc = "/hvas-logo.png";

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
