"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <>
        <p className="ok" role="status">
          We hebben een link gestuurd naar {email}. Open die op dit apparaat om in te loggen.
        </p>
        <p className="hint">Niets ontvangen na een paar minuten? Kijk in je map met ongewenste mail.</p>
      </>
    );
  }

  return (
    <form onSubmit={submit}>
      <label>
        E-mailadres
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button className="btn" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Versturen…" : "Stuur me een inloglink"}
      </button>
      {state === "error" && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
