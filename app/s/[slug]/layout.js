import { notFound } from "next/navigation";
import { getStoreBySlug } from "@/lib/storeResolver";
import { StoreProvider } from "./StoreContext";

/**
 * Layout for all store-scoped pages (/s/[slug]/...).
 * Resolves the store from the URL slug and provides it via context.
 * Returns 404 if the store doesn't exist or is inactive.
 */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);

  if (!store) {
    return { title: "Store Not Found" };
  }

  return {
    title: store.name,
    description: `Book your next massage at ${store.name}. ${store.address || ""}`.trim(),
  };
}

export default async function StoreLayout({ children, params }) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);

  if (!store) {
    notFound();
  }

  // Serialize only what the client needs (avoid passing sensitive fields)
  const clientStore = {
    id: store.id,
    name: store.name,
    slug: store.slug,
    phone: store.phone || "",
    address: store.address || "",
    logo_url: store.logo_url || "",
    theme_color: store.theme_color || "#C87D87",
    // Map actual DB columns → what the app expects
    business_hours_start: store.open_time || "09:00",
    business_hours_end: store.close_time || "20:00",
    timezone: store.timezone || "Australia/Sydney",
  };

  return <StoreProvider store={clientStore}>{children}</StoreProvider>;
}