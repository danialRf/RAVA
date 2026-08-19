/**
 * Public origin of the storefront, used for canonical URLs and the sitemap.
 * Falls back to the local development origin so metadata never contains a
 * placeholder domain.
 */
export function siteUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

/**
 * Origin used for a customer-facing checkout redirect.
 *
 * Production always uses the configured public origin. A production build is
 * also used for local QA, though, where the active loopback port can differ
 * from APP_URL. In that one constrained case the request host is authoritative
 * so a payment never sends the customer to a different local server.
 */
export function checkoutOrigin(requestHost: string | null): string {
  if (
    requestHost &&
    /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(requestHost)
  ) {
    return `http://${requestHost}`;
  }
  return new URL(siteUrl()).origin;
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
