/**
 * Icons for the homepage "brand promise" strip. Shared by the homepage and the
 * admin settings icon picker (client-safe — mirrors the types in lib/settings.ts).
 */

export type BrandPromiseIconKey =
  | 'truck'
  | 'return'
  | 'chat'
  | 'shield'
  | 'star'
  | 'heart'
  | 'clock'
  | 'check'
  | 'gift'
  | 'lock'
  | 'tag'
  | 'bolt';

export function BrandPromiseIcon({ icon, size = 28 }: { icon: BrandPromiseIconKey; size?: number }) {
  let content;
  switch (icon) {
    case 'truck':
      content = (
        <>
          <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" strokeLinejoin="round" />
          <circle cx="7" cy="17.5" r="1.75" />
          <circle cx="17.5" cy="17.5" r="1.75" />
        </>
      );
      break;
    case 'return':
      content = (
        <>
          <path d="M4 9h11a5 5 0 0 1 0 10H9" strokeLinecap="round" />
          <path d="M8 5 4 9l4 4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
      break;
    case 'chat':
      content = (
        <>
          <path d="M4 19.5 5.3 16A8 8 0 1 1 8 18.7z" strokeLinejoin="round" />
          <path d="M9 11h.01M12 11h.01M15 11h.01" strokeLinecap="round" strokeWidth="2" />
        </>
      );
      break;
    case 'shield':
      content = <path d="M12 3 4 7v5c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V7z" strokeLinejoin="round" />;
      break;
    case 'star':
      content = (
        <path
          d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
          strokeLinejoin="round"
        />
      );
      break;
    case 'heart':
      content = (
        <path
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          strokeLinejoin="round"
        />
      );
      break;
    case 'clock':
      content = (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" strokeLinecap="round" />
        </>
      );
      break;
    case 'check':
      content = <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />;
      break;
    case 'gift':
      content = (
        <>
          <rect x="3" y="8" width="18" height="14" strokeLinejoin="round" />
          <path
            d="M21 8H3V6a2 2 0 0 1 2-2h1.5A2.5 2.5 0 0 1 9 6.5V8m6 0V6.5A2.5 2.5 0 0 1 17.5 4H19a2 2 0 0 1 2 2v2zM12 8v14"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case 'lock':
      content = (
        <>
          <rect x="5" y="11" width="14" height="10" rx="1" strokeLinejoin="round" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
        </>
      );
      break;
    case 'tag':
      content = (
        <>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" strokeLinejoin="round" />
          <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case 'bolt':
      content = <path d="M13 2 4.09 12.96H12L11 22l8.91-10.96H13z" strokeLinejoin="round" />;
      break;
    default:
      return null;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}
