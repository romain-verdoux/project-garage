import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

let installed = false;

/**
 * Patches window.fetch so all TanStack Start server function calls
 * carry the current Supabase access token as a Bearer header.
 * Safe to mount multiple times — only patches once.
 */
export function ServerFnAuthBridge() {
  useEffect(() => {
    if (typeof window === "undefined" || installed) return;
    installed = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      try {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url && url.includes("/_serverFn/")) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) {
            const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
            if (!headers.has("authorization")) {
              headers.set("authorization", `Bearer ${token}`);
            }
            return originalFetch(input, { ...init, headers });
          }
        }
      } catch {
        // ignore — fall through to plain fetch
      }
      return originalFetch(input, init);
    };
  }, []);

  return null;
}
