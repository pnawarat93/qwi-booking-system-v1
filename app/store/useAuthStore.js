import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storeApiUrl } from "@/lib/storeApi";

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      loading: false,
      error: null,

      login: async (pin, slug) => {
        set({ loading: true, error: null });

        try {
          const res = await fetch(storeApiUrl(slug, "/auth/login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin }),
          });

          const data = await res.json();

          if (res.ok) {
            set({
              user: { ...data.user, store_slug: slug },
              loading: false,
              error: null,
            });
            return true;
          }

          set({
            error: data?.error || "Login failed",
            loading: false,
          });
          return false;
        } catch (error) {
          set({
            error: "Network error",
            loading: false,
          });
          return false;
        }
      },

      logout: () => {
        set({
          user: null,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

export { useAuthStore };
export default useAuthStore;