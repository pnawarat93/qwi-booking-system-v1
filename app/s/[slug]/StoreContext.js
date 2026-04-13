"use client";

import { createContext, useContext } from "react";

/**
 * React Context that provides store data to all components
 * under the /s/[slug] route tree.
 *
 * Contains: { id, name, slug, phone, address, logo_url,
 *             theme_color, business_hours_start, business_hours_end, timezone }
 */
const StoreContext = createContext(null);

export function StoreProvider({ store, children }) {
  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}

/**
 * Hook to access the current store data.
 * Must be used within a StoreProvider.
 *
 * @returns {object} Store data from the database
 */
export function useStore() {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useStore must be used within a StoreProvider (under /s/[slug] route)");
  }
  return store;
}

export default StoreContext;