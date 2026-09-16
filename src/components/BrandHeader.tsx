export function BrandHeader() {
  return (
    <div className="brand-row">
      <div className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="20" height="20">
          <g
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            transform="rotate(-20 32 36)"
          >
            <path d="M12 40 C20 22, 44 22, 52 40" strokeWidth="7" />
            <path d="M17 43 C24 29, 40 29, 47 43" strokeWidth="5.5" />
            <path d="M22 46 C27 36, 37 36, 42 46" strokeWidth="4" />
          </g>
        </svg>
      </div>
      <div className="brand-name">Sillage</div>
    </div>
  );
}
