"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
    <main className="page-narrow">
      <section className="hero-card">
        <span className="badge">Bela Arena</span>
        <h1 className="page-title mt-4">Login</h1>
        <p className="muted mt-4">Prijavi se i nastavi s turnirima, rezultatima i svojim profilom.</p>
      </section>

      <form onSubmit={login} className="card mt-8 space-y-4">
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

        <button className="btn-primary">
          Prijavi se
        </button>
      </form>
    </main>
  );
}