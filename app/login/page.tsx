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
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-4xl font-black text-yellow-400">Login</h1>

      <form onSubmit={login} className="mt-8 space-y-4">
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl bg-zinc-900 p-4"
          required
        />

        <input
          placeholder="Lozinka"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl bg-zinc-900 p-4"
          required
        />

        <button className="btn-primary">
          Prijavi se
        </button>
      </form>
    </main>
  );
}