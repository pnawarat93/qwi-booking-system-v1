import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      loading: false,
      error: null,
      login: async (pin) => {
        set({ loading: true, error: null });
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin }),
          });
          const data = await res.json();
          if (res.ok) {
            set({ user: data.user, loading: false });
            return true;
          } else {
            set({ error: data.error, loading: false });
            return false;
          }
        } catch (error) {
          set({ error: "Network error", loading: false });
          return false;
        }
      },
      logout: () => {
        set({ user: null });
      },
      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-storage", // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => sessionStorage), // Use sessionStorage so it clears when browser closes
    }
  )
);