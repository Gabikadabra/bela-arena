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
    groupScoreLimit: 701,
    knockoutScoreLimit: 1001,
    groupBestOf: 1,
    knockoutBestOf: 3,
    tournamentFormat: "knockout",
    hasRepechage: false,
    manualScoreEntry: false,
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
      score_limit: Number(form.knockoutScoreLimit),
      group_score_limit: Number(form.groupScoreLimit),
      knockout_score_limit: Number(form.knockoutScoreLimit),
      group_best_of: Number(form.groupBestOf),
      knockout_best_of: Number(form.knockoutBestOf),
      match_format: `best_of_${Number(form.knockoutBestOf)}`,
      tournament_format: form.tournamentFormat,
      has_repechage: form.hasRepechage,
      manual_score_entry: form.manualScoreEntry,
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
        groupScoreLimit: 701,
        knockoutScoreLimit: 1001,
        groupBestOf: 1,
        knockoutBestOf: 3,
        tournamentFormat: "knockout",
        hasRepechage: false,
        manualScoreEntry: false,
        rules: ""
      });
    }

    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10">
        <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
          Admin
        </p>

        <h1 className="text-4xl font-black text-[#f3dfad] sm:text-5xl">
          Novi turnir
        </h1>

        <p className="mt-4 max-w-2xl text-zinc-300">
          Kreiraj turnir i odaberi pravila igre, format natjecanja i sustav ždrijeba.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="card shadow-2xl"
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

          <Field label="Grupe se igraju do">
            <select
              value={form.groupScoreLimit}
              onChange={(e) => setForm({ ...form, groupScoreLimit: Number(e.target.value) })}
              className="input"
            >
              <option value={501}>501</option>
              <option value={701}>701</option>
              <option value={1001}>1001</option>
            </select>
          </Field>

          <Field label="Knockout se igra do">
            <select
              value={form.knockoutScoreLimit}
              onChange={(e) => setForm({ ...form, knockoutScoreLimit: Number(e.target.value) })}
              className="input"
            >
              <option value={501}>501</option>
              <option value={701}>701</option>
              <option value={1001}>1001</option>
              <option value={1501}>1501</option>
            </select>
          </Field>

          <Field label="Grupe - format meča">
            <select
              value={form.groupBestOf}
              onChange={(e) => setForm({ ...form, groupBestOf: Number(e.target.value) })}
              className="input"
            >
              <option value={1}>Jedna partija</option>
              <option value={3}>Do 2 pobjede / best of 3</option>
              <option value={5}>Do 3 pobjede / best of 5</option>
            </select>
          </Field>

          <Field label="Knockout - format meča">
            <select
              value={form.knockoutBestOf}
              onChange={(e) => setForm({ ...form, knockoutBestOf: Number(e.target.value) })}
              className="input"
            >
              <option value={1}>Jedna partija</option>
              <option value={3}>Do 2 pobjede / best of 3</option>
              <option value={5}>Do 3 pobjede / best of 5</option>
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
              <option value="round_robin">Liga / svatko sa svakim</option>
            </select>
          </Field>

          <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
            <div className="card-soft">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.hasRepechage}
                  onChange={(e) => setForm({ ...form, hasRepechage: e.target.checked })}
                  className="h-5 w-5"
                />
                <span className="font-bold text-[#d4b06a]">
                  Uključi repešaž
                </span>
              </label>

              <p className="mt-2 text-sm text-zinc-400">
                Repešaž omogućuje da poražene ekipe dobiju dodatnu šansu kroz dodatni dio natjecanja.
              </p>
            </div>

            <div className="card-soft">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.manualScoreEntry}
                  onChange={(e) => setForm({ ...form, manualScoreEntry: e.target.checked })}
                  className="h-5 w-5"
                />
                <span className="font-bold text-[#d4b06a]">
                  Manualni upis rezultata
                </span>
              </label>

              <p className="mt-2 text-sm text-zinc-400">
                Admin može ručno upisati konačan rezultat meča iz admin panela.
              </p>
            </div>
          </div>

          <div className="md:col-span-2">
            <Field label="Dodatna pravila">
              <textarea
                value={form.rules}
                onChange={(e) => setForm({ ...form, rules: e.target.value })}
                placeholder="npr. Grupe do 701, knockout do 1001, zvanja vrijede, bela se priznaje, pad se računa..."
                className="input min-h-32"
              />
            </Field>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[#d4b06a] px-8 py-4 font-black text-black transition hover:bg-[#f3dfad] disabled:opacity-50"
          >
            {loading ? "Spremam..." : "Kreiraj turnir"}
          </button>

          <a
            href="/admin"
            className="rounded-xl border border-[#d4b06a]/40 px-8 py-4 font-bold text-[#d4b06a] transition hover:bg-[#d4b06a]/10"
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
      <span className="mb-2 block text-sm font-bold text-[#d4b06a]">
        {label}
      </span>
      {children}
    </label>
  );
}