"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RegistracijaPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      setMessage(error.message);
    }
  }

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
    <main className="page flex min-h-[75vh] items-center justify-center">
      <section className="card w-full max-w-xl">
        <span className="badge">Bela Arena</span>
        <h1 className="page-title mt-4">Registracija</h1>
        <p className="muted mt-3">Napravi račun emailom ili nastavi preko Google računa.</p>

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

      <form onSubmit={register} className="space-y-4">
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

        <button className="btn-primary w-full">
          Registriraj se
        </button>
      </form>

      {message && <p className="mt-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-green-300">{message}</p>}

        <p className="muted mt-6 text-center text-sm">
          Već imaš račun? <a href="/login" className="font-black text-yellow-300">Prijavi se</a>
        </p>
      </section>
    </main>
  );
}