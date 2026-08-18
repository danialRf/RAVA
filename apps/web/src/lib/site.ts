/**
 * Public origin of the storefront, used for canonical URLs and the sitemap.
 * Falls back to the local development origin so metadata never contains a
 * placeholder domain.
 */
export function siteUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

/**
 * Whether cookies may carry the `Secure` attribute.
 *
 * Derived from the configured origin rather than NODE_ENV: a production build
 * served over plain HTTP (local verification, previews) must still be able to
 * store its session cookies.
 */
export function usesHttps(): boolean {
  return siteUrl().startsWith("https://");
}
