import { NavLink } from 'react-router-dom';

const items = [
  {
    to: '/',
    label: 'Fil',
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    to: '/album',
    label: 'Album',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10.5" r="1.5" />
        <path d="m21 15-4.5-4.5L7 20" />
      </svg>
    ),
  },
  {
    to: '/chercher',
    label: 'Chercher',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
    ),
  },
  {
    to: '/monde',
    label: 'Monde',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18" />
        <path d="M12 3a14 14 0 0 0 0 18" />
      </svg>
    ),
  },
  {
    to: '/tiroir',
    label: 'Tiroir',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M3 16h18M12 10v6" />
        <circle cx="12" cy="13" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
] as const;

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={'end' in item ? item.end : false}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
