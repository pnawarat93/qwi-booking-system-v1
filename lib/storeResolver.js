import { supabase } from "@/lib/supabase";

// Simple in-memory cache for store lookups (avoids repeated DB queries)
const storeCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Resolves a store slug to the full store record from the database.
 * Results are cached in memory to avoid repeated queries.
 *
 * @param {string} slug - The URL-friendly store identifier
 * @returns {Promise<object|null>} The store record or null
 */
export async function getStoreBySlug(slug) {
  if (!slug) return null;

  const normalizedSlug = slug.toLowerCase().trim();

  // Check cache
  const cached = storeCache.get(normalizedSlug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Query database
  // The stores table needs a `slug` column — see dump.sql notes.
  // We also use is_active if the column exists; otherwise we skip it.
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", normalizedSlug)
    .single();

  if (error || !data) {
    // Cache the miss too to avoid repeated queries for invalid slugs
    storeCache.set(normalizedSlug, { data: null, timestamp: Date.now() });
    return null;
  }

  // Cache the result
  storeCache.set(normalizedSlug, { data, timestamp: Date.now() });

  return data;
}

/**
 * Resolves slug from Next.js route params and returns the store.
 * Returns the store object or null if not found.
 *
 * @param {object} params - Next.js route params containing slug
 * @returns {Promise<object|null>}
 */
export async function resolveStoreFromParams(params) {
  const { slug } = await params;
  if (!slug) return null;
  return getStoreBySlug(slug);
}

/**
 * Clears the store cache (useful for testing or after store updates)
 */
export function clearStoreCache() {
  storeCache.clear();
}