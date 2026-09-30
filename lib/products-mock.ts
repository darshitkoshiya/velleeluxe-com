/**
 * Placeholder catalogue shown while the Google Sheet has no products yet.
 *
 * These match the real `Product` type exactly, so every page (shop, product,
 * cart) renders them like real stock. As soon as the sheet returns at least
 * one live product, these are no longer used (see lib/catalog.ts).
 *
 * Note: orders are priced on the server from the sheet, so mock products can
 * be browsed and added to the bag but cannot be paid for.
 */
import type { Product } from './types';

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

const CARE = 'Machine wash cold on a gentle cycle.\nDo not bleach.\nLine dry in shade.\nWarm iron on the reverse.';

/** Mock products that should carry the "Best Seller" badge. */
export const MOCK_BEST_SELLER_IDS: ReadonlySet<string> = new Set(['mock-sky-oxford', 'mock-poplin-dress-shirt']);

export const mockProducts: Product[] = [
  {
    id: 'mock-white-oxford',
    slug: 'white-oxford-button-down',
    name: 'The White Oxford Button-Down',
    description:
      'The shirt every wardrobe is built on. A soft, textured oxford cloth with a button-down collar, a single chest pocket and a tailored body that sits neatly under a blazer or on its own.',
    price: 1899,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    style: 'oxford',
    colour: 'white',
    fit: 'tailored',
    driveFolderId: '',
    images: [img('1598033129183-c4f50c736f10'), img('1603252109303-2751441dd157')],
    careInstructions: CARE,
    seoTitle: '',
    seoDescription: "White oxford button-down shirt for men — tailored fit, 100% cotton.",
    status: 'live',
    stock: 'unlimited',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
  },
  {
    id: 'mock-sky-oxford',
    slug: 'sky-blue-oxford-shirt',
    name: 'Sky Blue Oxford Shirt',
    description:
      'Our most-worn shirt, in a washed sky blue that goes with denim, chinos and tailoring alike. Brushed oxford cotton that gets softer with every wash.',
    price: 1899,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    style: 'oxford',
    colour: 'light blue',
    fit: 'tailored',
    driveFolderId: '',
    images: [img('1604695573706-53170668f6a6'), img('1602810319428-019690571b5b')],
    careInstructions: CARE,
    seoTitle: '',
    seoDescription: 'Sky blue oxford shirt for men — tailored fit, brushed cotton.',
    status: 'live',
    stock: 'unlimited',
    createdAt: daysAgo(60),
    updatedAt: daysAgo(20),
  },
  {
    id: 'mock-white-linen',
    slug: 'white-linen-resort-shirt',
    name: 'White Linen Resort Shirt',
    description:
      'Pure European linen in a relaxed cut for Indian summers. Breathable, lightweight and meant to be worn slightly rumpled, sleeves rolled.',
    price: 2199,
    compareAtPrice: 2799,
    sizes: ['S', 'M', 'L', 'XL'],
    style: 'linen',
    colour: 'white',
    fit: 'relaxed',
    driveFolderId: '',
    images: [img('1621072156002-e2fccdc0b176'), img('1617137968427-85924c800a22')],
    careInstructions: 'Hand wash or gentle machine wash cold.\nDo not tumble dry.\nIron while slightly damp.',
    seoTitle: '',
    seoDescription: 'White linen shirt for men — relaxed fit, pure linen.',
    status: 'live',
    stock: 'unlimited',
    createdAt: daysAgo(45),
    updatedAt: daysAgo(10),
  },
  {
    id: 'mock-chambray-utility',
    slug: 'chambray-utility-shirt',
    name: 'Chambray Utility Shirt',
    description:
      'A mid-weight chambray with a subtle woven dot, cut relaxed for weekends. Wear it buttoned up or open over a white tee.',
    price: 1799,
    sizes: ['M', 'L', 'XL', 'XXL'],
    style: 'chambray',
    colour: 'blue',
    fit: 'relaxed',
    driveFolderId: '',
    images: [img('1596755094514-f87e34085b2c'), img('1602810318383-e386cc2a3ccf')],
    careInstructions: CARE,
    seoTitle: '',
    seoDescription: 'Blue chambray shirt for men — relaxed fit.',
    status: 'live',
    stock: 'unlimited',
    createdAt: daysAgo(90),
    updatedAt: daysAgo(30),
  },
  {
    id: 'mock-poplin-dress-shirt',
    slug: 'light-blue-poplin-dress-shirt',
    name: 'Light Blue Poplin Dress Shirt',
    description:
      'Crisp two-ply cotton poplin with a spread collar and a clean, tailored line. The shirt for boardrooms, weddings and everything in between.',
    price: 2099,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    style: 'poplin',
    colour: 'light blue',
    fit: 'tailored',
    driveFolderId: '',
    images: [img('1620012253295-c15cc3e65df4'), img('1602810319428-019690571b5b')],
    careInstructions: CARE,
    seoTitle: '',
    seoDescription: 'Light blue poplin dress shirt for men — tailored fit.',
    status: 'live',
    stock: 'unlimited',
    createdAt: daysAgo(75),
    updatedAt: daysAgo(15),
  },
  {
    id: 'mock-lavender-poplin',
    slug: 'lavender-poplin-shirt',
    name: 'Lavender Poplin Shirt',
    description:
      'A quiet lavender in smooth cotton poplin. Softer than white, sharper than blue, and easy to pair with navy or grey trousers.',
    price: 1699,
    compareAtPrice: 2099,
    sizes: ['S', 'M', 'L', 'XL'],
    style: 'poplin',
    colour: 'lavender',
    fit: 'tailored',
    driveFolderId: '',
    images: [img('1588359348347-9bc6cbbb689e'), img('1602810318383-e386cc2a3ccf')],
    careInstructions: CARE,
    seoTitle: '',
    seoDescription: 'Lavender poplin shirt for men — tailored fit.',
    status: 'live',
    stock: 'unlimited',
    createdAt: daysAgo(35),
    updatedAt: daysAgo(12),
  },
  {
    id: 'mock-olive-check-overshirt',
    slug: 'olive-check-overshirt',
    name: 'Olive Check Overshirt',
    description:
      'A brushed cotton check in olive and ochre, cut oversized to layer over a tee. Two chest pockets and a softly structured collar.',
    price: 2499,
    sizes: ['M', 'L', 'XL', 'XXL'],
    style: 'flannel',
    colour: 'olive',
    fit: 'oversized',
    driveFolderId: '',
    images: [img('1607345366928-199ea26cfe3e')],
    careInstructions: CARE,
    seoTitle: '',
    seoDescription: 'Olive check overshirt for men — oversized fit, brushed cotton.',
    status: 'live',
    stock: 'unlimited',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(7),
  },
  {
    id: 'mock-teal-linen',
    slug: 'teal-linen-shirt',
    name: 'Teal Linen Shirt',
    description:
      'Washed linen in a muted teal, cut relaxed with a soft collar. The easy summer shirt for holidays, dinners and long afternoons.',
    price: 2199,
    sizes: ['S', 'M', 'L', 'XL'],
    style: 'linen',
    colour: 'teal',
    fit: 'relaxed',
    driveFolderId: '',
    images: [img('1589310243389-96a5483213a8'), img('1602810318383-e386cc2a3ccf')],
    careInstructions: 'Hand wash or gentle machine wash cold.\nDo not tumble dry.\nIron while slightly damp.',
    seoTitle: '',
    seoDescription: 'Teal linen shirt for men — relaxed fit.',
    status: 'live',
    stock: 12,
    createdAt: daysAgo(120),
    updatedAt: daysAgo(40),
  },
];

export function getMockProductBySlug(slug: string): Product | null {
  return mockProducts.find((product) => product.slug === slug) ?? null;
}
