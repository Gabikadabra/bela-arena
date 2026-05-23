"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      alert(error.message);
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/prijava";
  }

  return (
    <main className="page flex min-h-[75vh] items-center justify-center">
      <section className="card w-full max-w-xl">
        <span className="badge">Bela Arena</span>
        <h1 className="page-title mt-4">Login</h1>
        <p className="muted mt-3">Prijavi se emailom ili nastavi preko Google računa.</p>

        <button
          type="button"
          onClick={signInWithGoogle}
          className="btn-outline mt-8 flex w-full gap-3"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-black">
            G
          </span>
          Nastavi s Google
        </button>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-sm font-bold text-zinc-500">ili</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

      <form onSubmit={login} className="space-y-4">
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          required
        />

        <input
          placeholder="Lozinka"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          required
        />

        <button className="btn-primary w-full">
          Prijavi se
        </button>
      </form>

        <p className="muted mt-6 text-center text-sm">
          Nemaš račun? <a href="/registracija" className="font-black text-yellow-300">Registriraj se</a>
        </p>
      </section>
    </main>
  );
}