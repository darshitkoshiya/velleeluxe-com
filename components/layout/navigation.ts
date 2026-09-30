export interface NavItem {
  href: string;
  label: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

/**
 * Dropdown items for "Shop by Fabric" / "Shop by Patterns" are data-driven.
 * Phase 1: no products yet, so both lists are empty and the dropdowns show a
 * "Coming soon" placeholder. Phase 2: derive them from the product database
 * (Google Sheets) and pass them into <Header fabricLinks patternLinks />.
 */
export interface ShopFilterLinks {
  fabricLinks?: NavItem[];
  patternLinks?: NavItem[];
}

export function buildNavEntries({ fabricLinks = [], patternLinks = [] }: ShopFilterLinks = {}): NavEntry[] {
  return [
    { href: '/', label: 'Home' },
    { href: '/new-arrival', label: 'New Arrival' },
    { label: 'Shop by Fabric', items: fabricLinks },
    { label: 'Shop by Patterns', items: patternLinks },
    { href: '/sale', label: 'Sale' },
    { href: '/best-sellers', label: 'Best Sellers' },
  ];
}

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry;
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
