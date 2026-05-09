export default function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-gradient-to-r from-[#f1f5f2] via-[#e7efea] to-[#f1f5f2] bg-[length:200%_100%] ${className}`}
    />
  );
}
