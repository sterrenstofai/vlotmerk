"use client";

import { useEffect } from "react";

/**
 * Supabase stuurt naar het hoofdadres als de inloglink is verlopen, of als het terugkeeradres daar niet is toegestaan.
 * Dan sturen we de bezoeker alsnog door naar de juiste plek.
 */
export function AuthReturn() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = query.get("code");
    const failed = query.get("error_code") ?? hash.get("error_code") ?? query.get("error") ?? hash.get("error");
    if (code) window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}`);
    else if (failed) window.location.replace(`/login?error=${encodeURIComponent(failed)}`);
  }, []);
  return null;
}
