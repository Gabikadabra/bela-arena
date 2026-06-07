"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type TournamentForm = {
  name: string;
  location: string;
  startsAt: string;
  status: string;
  maxTeams: number;
  entryFee: number;
  groupScoreLimit: number;
  knockoutScoreLimit: number;
  groupBestOf: number;
  knockoutBestOf: number;
  tournamentFormat: string;
  groupSize: number;
  knockoutSize: number;
  leagueRounds: number;
  leagueMatchCount: number;
  hasRepechage: boolean;
  manualScoreEntry: boolean;
  rules: string;
};

const defaultForm: TournamentForm = {
  name: "",
  location: "",
  startsAt: "",
  status: "open",
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
};

const GROUP_FORMATS = new Set(["groups_knockout"]);
const LEAGUE_FORMATS = new Set(["round_robin", "league_knockout"]);
const KNOCKOUT_AFTER_FORMATS = new Set(["groups_knockout", "league_knockout"]);

export default function UrediTurnirPage() {
  const params = useParams();
  const tournamentId = String(params.tournamentId || "");
  const [form, setForm] = useState<TournamentForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const showGroups = GROUP_FORMATS.has(form.tournamentFormat);
  const showLeague = LEAGUE_FORMATS.has(form.tournamentFormat);
  const showKnockoutAfter = KNOCKOUT_AFTER_FORMATS.has(form.tournamentFormat);

  const formatHint = useMemo(() => {
    if (form.tournamentFormat === "knockout_repechage") return "Knockout s repesažom: ekipa ispada tek nakon drugog poraza.";
    if (form.tournamentFormat === "league_knockout") return "Liga prvaka format: liga faza s ograničenim brojem mečeva po ekipi, zatim najboljih X ide u knockout.";
    if (form.tournamentFormat === "groups_knockout") return "Grupe pa knockout: samo ovdje se prikazuju postavke grupa.";
    if (form.tournamentFormat === "round_robin") return "Liga format: svatko sa svakim bez završnog knockout-a.";
    return "Samo knockout: odmah se generira eliminacijski bracket.";
  }, [form.tournamentFormat]);

  useEffect(() => {
    if (!tournamentId) return;
    loadTournament();

    const channel = supabase
      .channel(`uredi-turnir-${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` }, () => {
        if (!saving) loadTournament(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, saving]);

  function dateOnly(value: string | null | undefined) {
    return value ? value.slice(0, 10) : "";
  }

  async function loadTournament(showLoader = true) {
    if (showLoader) setLoading(true);
    setMessage("");

    const { data, error } = await supabase.from("tournaments").select("*").eq("id", tournamentId).single();

    if (error) {
      setMessage("Greška: " + error.message);
      setLoading(false);
      return;
    }

    setForm({
      name: data.name || "",
      location: data.location || "",
      startsAt: dateOnly(data.starts_at),
      status: data.status || "open",
      maxTeams: Number(data.max_teams || 32),
      entryFee: Number(data.entry_fee || 0),
      groupScoreLimit: Number(data.group_score_limit || data.score_limit || 701),
      knockoutScoreLimit: Number(data.knockout_score_limit || data.score_limit || 1001),
      groupBestOf: Number(data.group_best_of || 1),
      knockoutBestOf: Number(data.knockout_best_of || (data.match_format === "best_of_5" ? 5 : data.match_format === "best_of_3" ? 3 : 1)),
      tournamentFormat: data.tournament_format || "knockout",
      groupSize: Number(data.group_size || 4),
      knockoutSize: Number(data.knockout_size || 16),
      leagueRounds: Number(data.league_rounds || 1),
      leagueMatchCount: Number(data.league_match_count || 8),
      hasRepechage: Boolean(data.has_repechage),
      manualScoreEntry: Boolean(data.manual_score_entry),
      rules: data.rules || ""
    });

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("tournaments").update({
      name: form.name,
      location: form.location,
      starts_at: form.startsAt || null,
      status: form.status,
      max_teams: Number(form.maxTeams),
      entry_fee: Number(form.entryFee),
      score_limit: Number(form.knockoutScoreLimit),
      group_score_limit: Number(form.groupScoreLimit),
      knockout_score_limit: Number(form.knockoutScoreLimit),
      group_best_of: Number(form.groupBestOf),
      knockout_best_of: Number(form.knockoutBestOf),
      match_format: `best_of_${Number(form.knockoutBestOf)}`,
      tournament_format: form.tournamentFormat,
      group_size: showGroups ? Number(form.groupSize) : null,
      knockout_size: form.tournamentFormat === "knockout_repechage" ? 16 : showKnockoutAfter ? Number(form.knockoutSize) : null,
      league_rounds: showLeague ? Number(form.leagueRounds) : 1,
      league_match_count: form.tournamentFormat === "league_knockout" ? Number(form.leagueMatchCount) : null,
      has_repechage: form.tournamentFormat === "knockout_repechage" || form.hasRepechage,
      manual_score_entry: form.manualScoreEntry,
      rules: form.rules
    }).eq("id", tournamentId);

    if (error) setMessage("Greška: " + error.message);
    else {
      setMessage("Turnir je uspješno ažuriran.");
      await loadTournament();
    }

    setSaving(false);
  }

  if (loading) return <main className="page"><section className="card"><p className="text-zinc-300">Učitavam turnir...</p></section></main>;

  return (
    <main className="page">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="badge mb-4">Admin</p>
          <h1 className="page-title">Uredi turnir</h1>
          <p className="muted mt-4 max-w-2xl">Promijeni podatke, status, limite bodova i format natjecanja.</p>
        </div>
        <div className="flex flex-wrap gap-3"><a href="/admin" className="btn-outline">Admin panel</a><a href={`/admin/zdrijeb?tournamentId=${tournamentId}`} className="btn-outline">Ždrijeb</a></div>
      </div>

      <form onSubmit={handleSubmit} className="card shadow-2xl">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Naziv turnira"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" required /></Field>
          <Field label="Lokacija"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input" required /></Field>
          <Field label="Datum turnira"><input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="input" /></Field>
          <Field label="Status turnira"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input"><option value="draft">Draft</option><option value="open">Otvorene prijave</option><option value="live">U tijeku</option><option value="finished">Završen</option><option value="closed">Zatvoren</option></select></Field>
          <Field label="Maksimalan broj ekipa"><input type="number" value={form.maxTeams} onChange={(e) => setForm({ ...form, maxTeams: Number(e.target.value) })} className="input" min={2} required /></Field>
          <Field label="Kotizacija (€)"><input type="number" value={form.entryFee} onChange={(e) => setForm({ ...form, entryFee: Number(e.target.value) })} className="input" min={0} /></Field>

          <Field label="Sustav turnira"><select value={form.tournamentFormat} onChange={(e) => setForm({ ...form, tournamentFormat: e.target.value })} className="input"><option value="knockout">Samo knockout</option><option value="groups_knockout">Grupe pa knockout</option>
              <option value="knockout_repechage">Knockout s repesažom</option><option value="round_robin">Liga / svatko sa svakim</option><option value="league_knockout">Liga prvaka / liga pa knockout</option></select></Field>

          <div className="md:col-span-2 card-soft"><p className="font-bold text-[#f3dfad]">Postavke formata</p><p className="muted mt-2 text-sm">{formatHint}</p></div>

          {showGroups && (<><Field label="Veličina grupe"><select value={form.groupSize} onChange={(e) => setForm({ ...form, groupSize: Number(e.target.value) })} className="input"><option value={3}>3 ekipe po grupi</option><option value={4}>4 ekipe po grupi</option><option value={5}>5 ekipa po grupi</option><option value={6}>6 ekipa po grupi</option></select></Field><Field label="Grupe se igraju do"><select value={form.groupScoreLimit} onChange={(e) => setForm({ ...form, groupScoreLimit: Number(e.target.value) })} className="input"><option value={501}>501</option><option value={701}>701</option><option value={1001}>1001</option><option value={1501}>1501</option></select></Field><Field label="Grupe - format meča"><select value={form.groupBestOf} onChange={(e) => setForm({ ...form, groupBestOf: Number(e.target.value) })} className="input"><option value={1}>Jedna partija</option><option value={3}>Do 2 pobjede / best of 3</option><option value={5}>Do 3 pobjede / best of 5</option></select></Field></>)}

          {showLeague && (<>{form.tournamentFormat === "league_knockout" ? <Field label="Broj mečeva po ekipi u liga fazi"><select value={form.leagueMatchCount} onChange={(e) => setForm({ ...form, leagueMatchCount: Number(e.target.value) })} className="input"><option value={3}>3 meča po ekipi</option><option value={4}>4 meča po ekipi</option><option value={5}>5 mečeva po ekipi</option><option value={6}>6 mečeva po ekipi</option><option value={7}>7 mečeva po ekipi</option><option value={8}>8 mečeva po ekipi</option></select></Field> : <Field label="Format lige"><select value={form.leagueRounds} onChange={(e) => setForm({ ...form, leagueRounds: Number(e.target.value) })} className="input"><option value={1}>Jednokružno — svatko sa svakim jednom</option><option value={2}>Dvokružno — svatko sa svakim dvaput</option></select></Field>}<Field label="Liga se igra do"><select value={form.groupScoreLimit} onChange={(e) => setForm({ ...form, groupScoreLimit: Number(e.target.value) })} className="input"><option value={501}>501</option><option value={701}>701</option><option value={1001}>1001</option><option value={1501}>1501</option></select></Field></>)}

          {showKnockoutAfter && <Field label="Koliko ekipa prolazi dalje u knockout"><select value={form.knockoutSize} onChange={(e) => setForm({ ...form, knockoutSize: Number(e.target.value) })} className="input"><option value={2}>2 ekipe</option><option value={4}>4 ekipe</option><option value={8}>8 ekipa</option><option value={16}>16 ekipa</option><option value={32}>32 ekipe</option></select></Field>}

          <Field label={showKnockoutAfter ? "Knockout se igra do" : "Meč se igra do"}><select value={form.knockoutScoreLimit} onChange={(e) => setForm({ ...form, knockoutScoreLimit: Number(e.target.value) })} className="input"><option value={501}>501</option><option value={701}>701</option><option value={1001}>1001</option><option value={1501}>1501</option></select></Field>
          <Field label={showKnockoutAfter ? "Knockout - format meča" : "Format meča"}><select value={form.knockoutBestOf} onChange={(e) => setForm({ ...form, knockoutBestOf: Number(e.target.value) })} className="input"><option value={1}>Jedna partija</option><option value={3}>Do 2 pobjede / best of 3</option><option value={5}>Do 3 pobjede / best of 5</option></select></Field>

          <div className="md:col-span-2 grid gap-4 md:grid-cols-2"><CheckCard checked={form.hasRepechage} onChange={(checked) => setForm({ ...form, hasRepechage: checked })} title="Uključi repešaž" text="Promjena formata ne briše postojeći ždrijeb. Ako želiš novi raspored, napravi ga ponovno u admin ždrijebu." /><CheckCard checked={form.manualScoreEntry} onChange={(checked) => setForm({ ...form, manualScoreEntry: checked })} title="Manualni upis rezultata" text="Kad je uključeno, admin može ručno spremiti konačne rezultate mečeva." /></div>
          <div className="md:col-span-2"><Field label="Dodatna pravila"><textarea value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} className="input min-h-32" /></Field></div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4"><button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Spremam..." : "Spremi promjene"}</button><a href={`/admin/uredi-turnir?tournamentId=${tournamentId}`} className="btn-outline">Nazad</a></div>
      </form>

      {message && <div className="mt-6 rounded-2xl border border-[#d4b06a]/30 bg-[#d4b06a]/10 p-5 font-bold text-[#d4b06a]">{message}</div>}
    </main>
  );
}

function CheckCard({ checked, onChange, title, text }: { checked: boolean; onChange: (checked: boolean) => void; title: string; text: string }) {
  return <div className="card-soft"><label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" /><span className="font-bold text-[#d4b06a]">{title}</span></label><p className="muted mt-2 text-sm">{text}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-[#d4b06a]">{label}</span>{children}</label>;
}
