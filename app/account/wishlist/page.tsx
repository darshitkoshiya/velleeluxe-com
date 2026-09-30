import { redirect } from 'next/navigation';

/** The wishlist now lives at /wishlist. Kept so existing header/menu links still work. */
export default function AccountWishlistRedirect() {
  redirect('/wishlist');
}
