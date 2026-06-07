"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const GROUP_FORMATS = new Set(["groups_knockout"]);
const LEAGUE_FORMATS = new Set(["round_robin", "league_knockout"]);
const KNOCKOUT_AFTER_FORMATS = new Set(["groups_knockout", "league_knockout"]);

function hasGroups(format: string) {
  return GROUP_FORMATS.has(format);
}

function hasLeague(format: string) {
  return LEAGUE_FORMATS.has(format);
}

function hasKnockoutAfter(format: string) {
  return KNOCKOUT_AFTER_FORMATS.has(format);
}

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
    groupSize: 4,
    knockoutSize: 16,
    leagueRounds: 1,
    leagueMatchCount: 8,
    hasRepechage: false,
    manualScoreEntry: false,
    rules: ""
  });

  const showGroups = hasGroups(form.tournamentFormat);
  const showLeague = hasLeague(form.tournamentFormat);
  const showKnockoutAfter = hasKnockoutAfter(form.tournamentFormat);

  const formatHint = useMemo(() => {
    if (form.tournamentFormat === "knockout_repechage") return "Knockout s repesažom: ekipa ispada tek nakon drugog poraza.";
    if (form.tournamentFormat === "league_knockout") {
      return "Liga prvaka format: liga faza s ograničenim brojem mečeva po ekipi, zatim najboljih X ide u knockout.";
    }

    if (form.tournamentFormat === "groups_knockout") {
      return "Grupe pa knockout: ekipe se dijele u grupe, a najbolji iz grupa prolaze dalje.";
    }

    if (form.tournamentFormat === "round_robin") {
      return "Liga format: svatko sa svakim bez završnog knockout-a.";
    }

    return "Samo knockout: odmah se generira eliminacijski bracket.";
  }, [form.tournamentFormat]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const tournamentFormat = form.tournamentFormat;
    const groupSize = showGroups ? Number(form.groupSize) : null;
    const knockoutSize = tournamentFormat === "knockout_repechage" ? 16 : showKnockoutAfter ? Number(form.knockoutSize) : null;
    const leagueRounds = showLeague ? Number(form.leagueRounds) : 1;
    const leagueMatchCount = tournamentFormat === "league_knockout" ? Number(form.leagueMatchCount) : null;

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
      tournament_format: tournamentFormat,
      group_size: groupSize,
      knockout_size: knockoutSize,
      league_rounds: leagueRounds,
      league_match_count: leagueMatchCount,
      has_repechage: tournamentFormat === "knockout_repechage" || form.hasRepechage,
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
        groupSize: 4,
        knockoutSize: 16,
        leagueRounds: 1,
        leagueMatchCount: 8,
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
        <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">Admin</p>
        <h1 className="text-4xl font-black text-[#f3dfad] sm:text-5xl">Novi turnir</h1>
        <p className="mt-4 max-w-2xl text-zinc-300">Kreiraj turnir i odaberi pravila igre, format natjecanja i sustav ždrijeba.</p>
      </div>

      <form onSubmit={handleSubmit} className="card shadow-2xl">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Naziv turnira"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="npr. Božićni turnir u beli" className="input" required /></Field>
          <Field label="Lokacija"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="npr. Novska" className="input" required /></Field>
          <Field label="Datum turnira"><input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="input" required /></Field>
          <Field label="Maksimalan broj ekipa"><input type="number" value={form.maxTeams} onChange={(e) => setForm({ ...form, maxTeams: Number(e.target.value) })} className="input" min={2} required /></Field>
          <Field label="Kotizacija (€)"><input type="number" value={form.entryFee} onChange={(e) => setForm({ ...form, entryFee: Number(e.target.value) })} className="input" min={0} /></Field>

          <Field label="Sustav turnira">
            <select value={form.tournamentFormat} onChange={(e) => setForm({ ...form, tournamentFormat: e.target.value })} className="input">
              <option value="knockout">Samo knockout</option>
              <option value="groups_knockout">Grupe pa knockout</option>
              <option value="knockout_repechage">Knockout s repesažom</option>
              <option value="round_robin">Liga / svatko sa svakim</option>
              <option value="league_knockout">Liga prvaka / liga pa knockout</option>
            </select>
          </Field>

          <div className="md:col-span-2 card-soft">
            <p className="font-bold text-[#f3dfad]">Odabrani format</p>
            <p className="muted mt-2">{formatHint}</p>
          </div>

          {showGroups && (
            <>
              <Field label="Veličina grupe">
                <select value={form.groupSize} onChange={(e) => setForm({ ...form, groupSize: Number(e.target.value) })} className="input">
                  <option value={3}>3 ekipe po grupi</option>
                  <option value={4}>4 ekipe po grupi</option>
                  <option value={5}>5 ekipa po grupi</option>
                  <option value={6}>6 ekipa po grupi</option>
                </select>
              </Field>

              <Field label="Grupe se igraju do">
                <select value={form.groupScoreLimit} onChange={(e) => setForm({ ...form, groupScoreLimit: Number(e.target.value) })} className="input">
                  <option value={501}>501</option><option value={701}>701</option><option value={1001}>1001</option><option value={1501}>1501</option>
                </select>
              </Field>

              <Field label="Grupe - format meča">
                <select value={form.groupBestOf} onChange={(e) => setForm({ ...form, groupBestOf: Number(e.target.value) })} className="input">
                  <option value={1}>Jedna partija</option><option value={3}>Do 2 pobjede / best of 3</option><option value={5}>Do 3 pobjede / best of 5</option>
                </select>
              </Field>
            </>
          )}

          {showLeague && (
            <>
              {form.tournamentFormat === "league_knockout" ? (
                <Field label="Broj mečeva po ekipi u liga fazi">
                  <select value={form.leagueMatchCount} onChange={(e) => setForm({ ...form, leagueMatchCount: Number(e.target.value) })} className="input">
                    <option value={3}>3 meča po ekipi</option>
                    <option value={4}>4 meča po ekipi</option>
                    <option value={5}>5 mečeva po ekipi</option>
                    <option value={6}>6 mečeva po ekipi</option>
                    <option value={7}>7 mečeva po ekipi</option>
                    <option value={8}>8 mečeva po ekipi</option>
                  </select>
                </Field>
              ) : (
                <Field label="Format lige">
                  <select value={form.leagueRounds} onChange={(e) => setForm({ ...form, leagueRounds: Number(e.target.value) })} className="input">
                    <option value={1}>Jednokružno — svatko sa svakim jednom</option>
                    <option value={2}>Dvokružno — svatko sa svakim dvaput</option>
                  </select>
                </Field>
              )}

              <Field label="Liga se igra do">
                <select value={form.groupScoreLimit} onChange={(e) => setForm({ ...form, groupScoreLimit: Number(e.target.value) })} className="input">
                  <option value={501}>501</option><option value={701}>701</option><option value={1001}>1001</option><option value={1501}>1501</option>
                </select>
              </Field>
            </>
          )}

          {showKnockoutAfter && (
            <Field label="Koliko ekipa prolazi dalje u knockout">
              <select value={form.knockoutSize} onChange={(e) => setForm({ ...form, knockoutSize: Number(e.target.value) })} className="input">
                <option value={2}>2 ekipe</option><option value={4}>4 ekipe</option><option value={8}>8 ekipa</option><option value={16}>16 ekipa</option><option value={32}>32 ekipe</option>
              </select>
            </Field>
          )}

          <Field label={showKnockoutAfter ? "Knockout se igra do" : "Meč se igra do"}>
            <select value={form.knockoutScoreLimit} onChange={(e) => setForm({ ...form, knockoutScoreLimit: Number(e.target.value) })} className="input">
              <option value={501}>501</option><option value={701}>701</option><option value={1001}>1001</option><option value={1501}>1501</option>
            </select>
          </Field>

          <Field label={showKnockoutAfter ? "Knockout - format meča" : "Format meča"}>
            <select value={form.knockoutBestOf} onChange={(e) => setForm({ ...form, knockoutBestOf: Number(e.target.value) })} className="input">
              <option value={1}>Jedna partija</option><option value={3}>Do 2 pobjede / best of 3</option><option value={5}>Do 3 pobjede / best of 5</option>
            </select>
          </Field>

          <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
            <CheckCard checked={form.hasRepechage} onChange={(checked) => setForm({ ...form, hasRepechage: checked })} title="Uključi repešaž" text="Repešaž ostaje opcija za kasniju nadogradnju/ručnu organizaciju." />
            <CheckCard checked={form.manualScoreEntry} onChange={(checked) => setForm({ ...form, manualScoreEntry: checked })} title="Manualni upis rezultata" text="Admin može ručno upisati konačan rezultat meča iz admin panela." />
          </div>

          <div className="md:col-span-2">
            <Field label="Dodatna pravila"><textarea value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} placeholder="npr. Liga do 701, knockout do 1001, prolazi 8 najboljih..." className="input min-h-32" /></Field>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={loading} className="rounded-xl bg-[#d4b06a] px-8 py-4 font-black text-black transition hover:bg-[#f3dfad] disabled:opacity-50">{loading ? "Spremam..." : "Kreiraj turnir"}</button>
          <a href="/admin" className="rounded-xl border border-[#d4b06a]/40 px-8 py-4 font-bold text-[#d4b06a] transition hover:bg-[#d4b06a]/10">Nazad na admin</a>
        </div>
      </form>

      {message && <div className="mt-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-green-300">{message}</div>}
    </main>
  );
}

function CheckCard({ checked, onChange, title, text }: { checked: boolean; onChange: (checked: boolean) => void; title: string; text: string }) {
  return (
    <div className="card-soft">
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />
        <span className="font-bold text-[#d4b06a]">{title}</span>
      </label>
      <p className="mt-2 text-sm text-zinc-400">{text}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-[#d4b06a]">{label}</span>{children}</label>;
}
