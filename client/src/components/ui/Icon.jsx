/**
 * Single icon system for the whole app.
 *
 * One visual language: 24px grid, rounded caps/joins, 1.9 stroke,
 * `currentColor` so every icon inherits the surrounding text colour.
 * Always render inside a button/label that carries the accessible name —
 * icons themselves are decorative (`aria-hidden`).
 */
const PATHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2.2 10.4a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 2-1.55L20.5 8H6" />
      <circle cx="10" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.6v2M12 19.4v2M4.6 4.6 6 6M18 18l1.4 1.4M2.6 12h2M19.4 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.6A8.6 8.6 0 0 1 9.4 4 8.6 8.6 0 1 0 20 14.6Z" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  arrowRight: (
    <>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8 6 12l4 4" />
      <path d="M6 12h9" />
    </>
  ),
  package: (
    <>
      <path d="M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5v-9Z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </>
  ),
  location: (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  check: <path d="m5 12.6 4.6 4.6L19 7.4" />,
  chef: (
    <>
      <path d="M7 21h10" />
      <path d="M6.6 18.2h10.8v-5a4.4 4.4 0 1 0-3-4.15A4.4 4.4 0 0 0 6.6 13.2v5Z" />
    </>
  ),
  car: (
    <>
      <path d="M4 16.5v-3.4L6 8h12l2 5.1v3.4" />
      <path d="M4 16.5h16" />
      <circle cx="7.6" cy="17.8" r="1.7" />
      <circle cx="16.4" cy="17.8" r="1.7" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M3 10.2h18" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-2.6-1.6L12.8 21l-2.4-1.6L7.8 21 6 19.8V3Z" />
      <path d="M9.2 8.4h5.6M9.2 12.4h5.6" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.7-6" />
      <path d="M20.2 4.4v4.8h-4.8" />
    </>
  ),
  heart: (
    <path d="M12 20s-7.6-4.7-7.6-9.6A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.6 2.7C19.6 15.3 12 20 12 20Z" />
  ),
  phone: (
    <path d="M7 3.6h3l1.5 4-2 1.4a12.3 12.3 0 0 0 5.5 5.5l1.4-2 4 1.5v3a2 2 0 0 1-2.1 2A16.6 16.6 0 0 1 5 5.7a2 2 0 0 1 2-2.1Z" />
  ),
  pizza: (
    <>
      <path d="M12 3.4 3.7 19.3a.7.7 0 0 0 .6 1.05h15.4a.7.7 0 0 0 .6-1.05L12 3.4Z" />
      <circle cx="11" cy="11.4" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="14.8" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="9.6" cy="15.6" r="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  sparkle: (
    <path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9 12 3.5Z" />
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  minus: <path d="M5.5 12h13" />,
  cup: (
    <>
      <path d="M6.5 4h11l-1.2 14.1A2.8 2.8 0 0 1 13.5 20.9h-3a2.8 2.8 0 0 1-2.8-2.8L6.5 4Z" />
      <path d="M17.4 7H19a2.6 2.6 0 0 1 0 5.2h-1.7" />
      <path d="M7.5 9.6h9" />
    </>
  ),
};

const Icon = ({ name, size = 20, strokeWidth = 1.9, className = '', ...rest }) => {
  const content = PATHS[name];
  if (!content) return null;

  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {content}
    </svg>
  );
};

export default Icon;
