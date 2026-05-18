"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NoviTurnirPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    location: "",
    startsAt: "",
    maxTeams: 32,
    entryFee: 0,
    scoreLimit: 1001,
    matchFormat: "best_of_3",
    tournamentFormat: "knockout",
    hasRepechage: false,
    rules: ""
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.from("tournaments").insert({
      name: form.name,
      location: form.location,
      starts_at: form.startsAt,
      status: "open",
      max_teams: Number(form.maxTeams),
      entry_fee: Number(form.entryFee),
      score_limit: Number(form.scoreLimit),
      match_format: form.matchFormat,
      tournament_format: form.tournamentFormat,
      has_repechage: form.hasRepechage,
      rules: form.rules
    });

    if (error) {
      setMessage("Greška: " + error.message);
    } else {
      setMessage("Turnir je uspješno kreiran!");
      setForm({
        name: "",
        location: "",
        startsAt: "",
        maxTeams: 32,
        entryFee: 0,
        scoreLimit: 1001,
        matchFormat: "best_of_3",
        tournamentFormat: "knockout",
        hasRepechage: false,
        rules: ""
      });
    }

    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10">
        <p className="mb-4 inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
          Admin
        </p>

        <h1 className="text-5xl font-black text-yellow-400">
          Novi turnir
        </h1>

        <p className="mt-4 max-w-2xl text-zinc-300">
          Kreiraj turnir i odaberi pravila igre, format natjecanja i sustav ždrijeba.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-white/10 bg-zinc-950/80 p-8 shadow-2xl"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Naziv turnira">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="npr. Božićni turnir u beli"
              className="input"
              required
            />
          </Field>

          <Field label="Lokacija">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="npr. Novska"
              className="input"
              required
            />
          </Field>

          <Field label="Datum turnira">
            <input
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className="input"
              required
            />
          </Field>

          <Field label="Maksimalan broj ekipa">
            <input
              type="number"
              value={form.maxTeams}
              onChange={(e) => setForm({ ...form, maxTeams: Number(e.target.value) })}
              className="input"
              min={2}
              required
            />
          </Field>

          <Field label="Kotizacija (€)">
            <input
              type="number"
              value={form.entryFee}
              onChange={(e) => setForm({ ...form, entryFee: Number(e.target.value) })}
              className="input"
              min={0}
            />
          </Field>

          <Field label="Igra se do">
            <select
              value={form.scoreLimit}
              onChange={(e) => setForm({ ...form, scoreLimit: Number(e.target.value) })}
              className="input"
            >
              <option value={501}>501</option>
              <option value={701}>701</option>
              <option value={1001}>1001</option>
            </select>
          </Field>

          <Field label="Format meča">
            <select
              value={form.matchFormat}
              onChange={(e) => setForm({ ...form, matchFormat: e.target.value })}
              className="input"
            >
              <option value="best_of_1">Jedna partija</option>
              <option value="best_of_3">Do 2 pobjede</option>
              <option value="best_of_5">Do 3 pobjede</option>
            </select>
          </Field>

          <Field label="Sustav turnira">
            <select
              value={form.tournamentFormat}
              onChange={(e) => setForm({ ...form, tournamentFormat: e.target.value })}
              className="input"
            >
              <option value="knockout">Samo knockout</option>
              <option value="groups_knockout">Grupe pa knockout</option>
              <option value="round_robin">Round robin / svatko sa svakim</option>
            </select>
          </Field>

          <div className="md:col-span-2 rounded-2xl border border-white/10 bg-zinc-900 p-5">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.hasRepechage}
                onChange={(e) => setForm({ ...form, hasRepechage: e.target.checked })}
                className="h-5 w-5"
              />
              <span className="font-bold text-yellow-300">
                Uključi repešaž
              </span>
            </label>

            <p className="mt-2 text-sm text-zinc-400">
              Repešaž omogućuje da poražene ekipe dobiju dodatnu šansu kroz dodatni dio natjecanja.
            </p>
          </div>

          <div className="md:col-span-2">
            <Field label="Dodatna pravila">
              <textarea
                value={form.rules}
                onChange={(e) => setForm({ ...form, rules: e.target.value })}
                placeholder="npr. Igra se do 1001, zvanja vrijede, bela se priznaje, pad se računa..."
                className="input min-h-32"
              />
            </Field>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-yellow-400 px-8 py-4 font-black text-black transition hover:bg-yellow-300 disabled:opacity-50"
          >
            {loading ? "Spremam..." : "Kreiraj turnir"}
          </button>

          <a
            href="/admin"
            className="rounded-xl border border-yellow-500/40 px-8 py-4 font-bold text-yellow-300 transition hover:bg-yellow-500/10"
          >
            Nazad na admin
          </a>
        </div>
      </form>

      {message && (
        <div className="mt-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-green-300">
          {message}
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-yellow-300">
        {label}
      </span>
      {children}
    </label>
  );
}