"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Prijavljujem te...");

  useEffect(() => {
    finishLogin();
  }, []);

  async function finishLogin() {
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setMessage("Greška kod Google prijave: " + error.message);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setMessage("Prijava nije dovršena. Pokušaj ponovno.");
        return;
      }

      window.location.href = "/moj-racun";
    } catch {
      setMessage("Dogodila se greška kod prijave.");
    }
  }

  return (
    <main className="page flex min-h-[70vh] items-center justify-center">
      <section className="card w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-400 text-3xl font-black text-black">
          G
        </div>

        <h1 className="section-title">Google prijava</h1>
        <p className="muted mt-3">{message}</p>
      </section>
    </main>
  );
}
