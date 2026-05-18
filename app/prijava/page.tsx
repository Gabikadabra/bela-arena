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
        tournamentId: data?.[0]?.id || "",
        email: user?.email || ""
      }));
    }

    init();
  }, []);

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
      partner_email: form.partnerEmail,
      partner_user_id: null,
      invite_status: "pending",
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

    // SEND EMAIL INVITE
    await fetch("/api/send-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        partnerEmail: form.partnerEmail,
        captainName: form.captain,
        teamName: form.teamName,
        tournamentName: selectedTournament?.name || "Bela Arena"
      })
    });

    setMessageType("success");
    setMessage(
      "Ekipa prijavljena. Partner je dobio email poziv, admin mora potvrditi ekipu."
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
      <main className="page-narrow">
        <div className="hero-card">
          <h1 className="page-title">
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

  return (
    <main className="page">
      <section className="hero-card mb-8">
        <span className="badge">Turnirska prijava</span>
        <h1 className="page-title mt-4">
          Prijava ekipe
        </h1>
        <p className="muted mt-4">Unesi podatke ekipe i odaberi otvoreni turnir.</p>
      </section>

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

          <Field label="Email partnera">
            <input
              type="email"
              value={form.partnerEmail}
              onChange={(e) =>
                setForm({ ...form, partnerEmail: e.target.value })
              }
              className="input"
              required
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
          className="mt-8 btn-primary"
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
      <span className="mb-2 block text-sm font-bold text-yellow-300">
        {label}
      </span>
      {children}
    </label>
  );
}