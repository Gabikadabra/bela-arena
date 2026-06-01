"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PrijavaPage() {
  const [user, setUser] = useState<any>(null);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    tournamentId: "",
    teamName: "",
    city: "",
    captain: "",
    playerOne: "",
    playerTwo: "",
    partnerEmail: "",
    phone: "",
    email: ""
  });

  useEffect(() => {
    async function init() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      setUser(user);
      await loadOpenTournaments(user?.email || "");
    }

    init();

    const channel = supabase
      .channel("prijava-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => loadOpenTournaments(user?.email || form.email || "")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        () => loadOpenTournaments(user?.email || form.email || "")
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadOpenTournaments(email = "") {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("status", "open")
      .order("starts_at", { ascending: true });

    if (error) {
      setMessageType("error");
      setMessage("Greška kod dohvaćanja turnira: " + error.message);
      return;
    }

    setTournaments(data || []);

    setForm((prev) => ({
      ...prev,
      tournamentId:
        prev.tournamentId && data?.some((t) => t.id === prev.tournamentId)
          ? prev.tournamentId
          : data?.[0]?.id || "",
      email: prev.email || email
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!user) {
      setMessageType("error");
      setMessage("Moraš se prvo prijaviti.");
      return;
    }

    if (!form.tournamentId) {
      setMessageType("error");
      setMessage("Odaberi turnir.");
      return;
    }

    setLoading(true);

    const { data: existingTeam } = await supabase
      .from("teams")
      .select("id")
      .eq("tournament_id", form.tournamentId)
      .eq("captain_user_id", user.id)
      .maybeSingle();

    if (existingTeam) {
      setMessageType("error");
      setMessage("Već si prijavio ekipu za ovaj turnir.");
      setLoading(false);
      return;
    }

    const selectedTournament = tournaments.find(
      (t) => t.id === form.tournamentId
    );

    const { error } = await supabase.from("teams").insert({
      tournament_id: form.tournamentId,
      name: form.teamName,
      city: form.city,
      captain_name: form.captain,
      captain_user_id: user.id,
      player_one: form.playerOne,
      player_two: form.playerTwo,
      partner_email: form.partnerEmail.trim() || null,
      partner_user_id: null,
      invite_status: form.partnerEmail.trim() ? "pending" : "not_required",
      phone: form.phone,
      email: form.email,
      status: "pending"
    });

    if (error) {
      setMessageType("error");
      setMessage("Greška kod prijave: " + error.message);
      setLoading(false);
      return;
    }

    if (form.partnerEmail.trim()) {
      await fetch("/api/send_invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          partnerEmail: form.partnerEmail.trim(),
          captainName: form.captain,
          teamName: form.teamName,
          tournamentName: selectedTournament?.name || "Bela Arena"
        })
      });
    }

    setMessageType("success");
    setMessage(
      form.partnerEmail.trim()
        ? "Ekipa prijavljena. Partner je dobio email poziv, admin mora potvrditi ekipu."
        : "Ekipa prijavljena bez maila partnera. Admin mora potvrditi ekipu."
    );

    setForm({
      tournamentId: tournaments[0]?.id || "",
      teamName: "",
      city: "",
      captain: "",
      playerOne: "",
      playerTwo: "",
      partnerEmail: "",
      phone: "",
      email: user.email || ""
    });

    setLoading(false);
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-3xl border border-[#d4b06a]/20 bg-[#184332]/85 p-10 shadow-2xl">
          <h1 className="text-4xl font-black text-[#f3dfad] sm:text-5xl">
            Prvo se prijavi
          </h1>

          <p className="mt-4 text-lg text-zinc-300">
            Moraš imati račun za prijavu ekipe.
          </p>

          <div className="mt-8 flex gap-4">
            <a
              href="/login"
              className="btn-primary"
            >
              Login
            </a>

            <a
              href="/registracija"
              className="btn-outline"
            >
              Registracija
            </a>
          </div>
        </div>
      </main>
    );
  }

  const selectedTournament = tournaments.find((t) => t.id === form.tournamentId);
  const hasGroupSettings = selectedTournament?.tournament_format === "groups_knockout";
  const hasLeagueSettings = ["round_robin", "league_knockout"].includes(selectedTournament?.tournament_format);
  const hasKnockoutAfter = ["groups_knockout", "league_knockout"].includes(selectedTournament?.tournament_format);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-[#f3dfad] sm:text-5xl">
          Prijava ekipe
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="card"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Turnir">
            <select
              value={form.tournamentId}
              onChange={(e) =>
                setForm({ ...form, tournamentId: e.target.value })
              }
              className="input"
              required
            >
              <option value="">Odaberi turnir</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </Field>

          {selectedTournament && (
            <div className="md:col-span-2 card-soft">
              <p className="font-bold text-[#f3dfad]">Postavke turnira</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold text-white/70">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Format: {selectedTournament.tournament_format === "league_knockout" ? "Liga prvaka" : selectedTournament.tournament_format === "groups_knockout" ? "Grupe + knockout" : selectedTournament.tournament_format === "round_robin" ? "Liga" : "Knockout"}</span>
                {hasGroupSettings && <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Grupe: {selectedTournament.group_size || 4} ekipe</span>}
                {hasLeagueSettings && <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Liga: {selectedTournament.tournament_format === "league_knockout" ? `${Number(selectedTournament.league_match_count || 8)} mečeva po ekipi` : Number(selectedTournament.league_rounds || 1) === 2 ? "dvokružno" : "jednokružno"}</span>}
                {hasKnockoutAfter && <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Prolazi dalje: {selectedTournament.knockout_size || 16}</span>}
              </div>
              {hasGroupSettings && (
                <p className="muted mt-3 text-sm">Ovaj turnir ima grupnu fazu, zato se prikazuju postavke grupa.</p>
              )}
            </div>
          )}

          <Field label="Naziv ekipe">
            <input
              value={form.teamName}
              onChange={(e) =>
                setForm({ ...form, teamName: e.target.value })
              }
              className="input"
              required
            />
          </Field>

          <Field label="Grad">
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="input"
            />
          </Field>

          <Field label="Kapetan">
            <input
              value={form.captain}
              onChange={(e) => setForm({ ...form, captain: e.target.value })}
              className="input"
              required
            />
          </Field>

          <Field label="Igrač 1">
            <input
              value={form.playerOne}
              onChange={(e) =>
                setForm({ ...form, playerOne: e.target.value })
              }
              className="input"
              required
            />
          </Field>

          <Field label="Igrač 2">
            <input
              value={form.playerTwo}
              onChange={(e) =>
                setForm({ ...form, playerTwo: e.target.value })
              }
              className="input"
              required
            />
          </Field>

          <Field label="Email partnera (nije obavezno)">
            <input
              type="email"
              value={form.partnerEmail}
              onChange={(e) =>
                setForm({ ...form, partnerEmail: e.target.value })
              }
              className="input"
            />
          </Field>

          <Field label="Telefon">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-8 rounded-xl bg-[#d4b06a] px-8 py-4 font-black text-black"
        >
          {loading ? "Šaljem..." : "Prijavi ekipu"}
        </button>
      </form>

      {message && (
        <div
          className={`mt-6 rounded-2xl border p-5 ${
            messageType === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
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