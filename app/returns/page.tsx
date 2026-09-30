import { permanentRedirect } from 'next/navigation';

/** Short URL alias — the canonical Return Policy lives at /return-policy (linked from the footer and sitemap). */
export default function ReturnsAlias() {
  permanentRedirect('/return-policy');
}
