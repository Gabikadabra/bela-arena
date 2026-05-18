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
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-4xl font-black text-yellow-400">Registracija</h1>

      <form onSubmit={register} className="mt-8 space-y-4">
        <input
          placeholder="Ime i prezime"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-xl bg-zinc-900 p-4"
          required
        />

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
          minLength={6}
        />

        <button className="rounded-xl bg-yellow-400 px-6 py-3 font-bold text-black">
          Registriraj se
        </button>
      </form>

      {message && <p className="mt-6 text-green-400">{message}</p>}
    </main>
  );
}