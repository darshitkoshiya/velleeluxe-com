import { permanentRedirect } from 'next/navigation';

/** Short URL alias — the canonical Privacy Policy lives at /privacy-policy (linked from the footer and sitemap). */
export default function PrivacyAlias() {
  permanentRedirect('/privacy-policy');
}
