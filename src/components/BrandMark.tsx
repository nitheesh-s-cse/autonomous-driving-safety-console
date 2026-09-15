export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="7" stroke="rgba(255,255,255,0.12)" />
      <path d="M7 8L25 24" stroke="#21D4FD" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M25 8L7 24" stroke="#3B82F6" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
      <circle cx="16" cy="16" r="2.1" fill="#21D4FD" />
    </svg>
  );
}
