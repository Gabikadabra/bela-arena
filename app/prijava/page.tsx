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
      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData.user;

      setUser(currentUser);

      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .order("starts_at", { ascending: true });

      if (error) {
        setMessageType("error");
        setMessage("Greška kod dohvaćanja turnira: " + error.message);
        return;
      }

      setTournaments(data || []);

      setForm((prev) => ({
        ...prev,
        tournamentId: data && data.length > 0 ? data[0].id : "",
        email: currentUser?.email || ""
      }));
    }

    init();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!user) {
      setMessageType("error");
      setMessage("Moraš se prvo prijaviti ili registrirati.");
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
  .select("id, name")
  .eq("tournament_id", form.tournamentId)
  .eq("captain_user_id", user.id)
  .maybeSingle();

if (existingTeam) {
  setMessageType("error");
  setMessage("Već si prijavio ekipu za ovaj turnir.");
  setLoading(false);
  return;
}

    const { error } = await supabase.from("teams").insert({
      tournament_id: form.tournamentId,
      name: form.teamName,
      city: form.city,
      captain_name: form.captain,
      captain_user_id: user?.id || null,
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
    } else {
      setMessageType("success");
      setMessage(
        "Ekipa je prijavljena! Partner treba prihvatiti poziv, a admin potvrditi ekipu."
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
    }

    setLoading(false);
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-3xl border border-yellow-500/20 bg-zinc-950/80 p-10 shadow-2xl">
          <p className="mb-4 inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
            Prijava ekipe
          </p>

          <h1 className="text-5xl font-black text-yellow-400">
            Prvo se prijavi
          </h1>

          <p className="mt-4 text-lg text-zinc-300">
            Za prijavu ekipe moraš imati račun i potvrđen email.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="/login"
              className="rounded-xl bg-yellow-400 px-6 py-3 font-bold text-black transition hover:bg-yellow-300"
            >
              Login
            </a>

            <a
              href="/registracija"
              className="rounded-xl border border-yellow-500/40 px-6 py-3 font-bold text-yellow-300 transition hover:bg-yellow-500/10"
            >
              Registracija
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10">
        <p className="mb-4 inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
          Bela Arena prijava
        </p>

        <h1 className="text-5xl font-black text-yellow-400">
          Prijava ekipe
        </h1>

        <p className="mt-4 max-w-2xl text-zinc-300">
          Odaberi turnir, upiši podatke ekipe i pozovi partnera preko emaila.
        </p>
      </div>

      {tournaments.length === 0 && (
        <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
          Trenutno nema dostupnih turnira.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl border border-white/10 bg-zinc-950/80 p-8 shadow-2xl"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-bold text-yellow-300">
              Turnir
            </label>

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
                  {tournament.name} — {tournament.location}
                </option>
              ))}
            </select>
          </div>

          <Field label="Naziv ekipe">
            <input
              value={form.teamName}
              onChange={(e) =>
                setForm({ ...form, teamName: e.target.value })
              }
              className="input"
              placeholder="npr. Kumovi"
              required
            />
          </Field>

          <Field label="Grad">
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="input"
              placeholder="npr. Novska"
            />
          </Field>

          <Field label="Kapetan">
            <input
              value={form.captain}
              onChange={(e) => setForm({ ...form, captain: e.target.value })}
              className="input"
              placeholder="Ime kapetana"
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
              placeholder="Ime prvog igrača"
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
              placeholder="Ime drugog igrača"
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
              placeholder="partner@email.com"
              required
            />
          </Field>

          <Field label="Telefon">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input"
              placeholder="099..."
            />
          </Field>

          <Field label="Email kapetana">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              placeholder="email@example.com"
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={loading || tournaments.length === 0}
          className="mt-8 rounded-xl bg-yellow-400 px-8 py-4 font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Šaljem prijavu..." : "Prijavi ekipu"}
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