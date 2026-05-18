"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RegistracijaPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "http://localhost:3000/login",
        data: {
          full_name: fullName
        }
      }
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Registracija uspješna! Provjeri email i potvrdi račun.");
  }

  return (
    <main className="page-narrow">
      <section className="hero-card">
        <span className="badge">Bela Arena</span>
        <h1 className="page-title mt-4">Registracija</h1>
        <p className="muted mt-4">Napravi račun za prijave ekipa, live rezultate i povijest mečeva.</p>
      </section>

      <form onSubmit={register} className="card mt-8 space-y-4">
        <input
          placeholder="Ime i prezime"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="input"
          required
        />

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
          minLength={6}
        />

        <button className="btn-primary">
          Registriraj se
        </button>
      </form>

      {message && <p className="mt-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 font-bold text-green-300">{message}</p>}
    </main>
  );
}