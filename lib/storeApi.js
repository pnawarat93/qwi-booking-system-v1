/**
 * Builds a store-scoped API URL path.
 * Used by all frontend components and Zustand stores
 * to route API calls to the correct store's endpoints.
 *
 * @param {string} slug - The store's URL slug
 * @param {string} path - The API path (e.g. "/booking", "/services")
 * @returns {string} The full API path (e.g. "/api/s/zen-thai/booking")
 */
export function storeApiUrl(slug, path) {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/api/s/${slug}${normalizedPath}`;
}