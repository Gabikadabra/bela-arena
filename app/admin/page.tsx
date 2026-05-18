"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");

  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  function loginAdmin(e: React.FormEvent) {
    e.preventDefault();

    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      sessionStorage.setItem("bela_admin", "true");
      setIsAdmin(true);
    } else {
      alert("Kriva lozinka.");
    }
  }

  function logoutAdmin() {
    sessionStorage.removeItem("bela_admin");
    setIsAdmin(false);
  }

  async function loadTournaments() {
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .order("starts_at", { ascending: true });

    setTournaments(data || []);

    if (data && data.length > 0) {
      setSelectedTournament(data[0].id);
    }
  }

  async function loadTeams(tournamentId: string) {
    setLoading(true);

    const { data } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false });

    setTeams(data || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("teams").update({ status }).eq("id", id);

    if (selectedTournament) {
      loadTeams(selectedTournament);
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("bela_admin");

    if (saved === "true") {
      setIsAdmin(true);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadTournaments();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (selectedTournament) {
      loadTeams(selectedTournament);
    }
  }, [selectedTournament]);

  useEffect(() => {
    if (!isAdmin) return;

    const interval = setInterval(() => {
      window.location.reload();
    }, 120000); // 2 minute

    return () => clearInterval(interval);
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <div className="rounded-3xl border border-yellow-500/20 bg-zinc-950/80 p-8 shadow-2xl">
          <p className="mb-4 inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
            Admin pristup
          </p>

          <h1 className="text-4xl font-black text-yellow-400">
            Unesi admin lozinku
          </h1>

          <form onSubmit={loginAdmin} className="mt-8 space-y-4">
            <input
              type="password"
              placeholder="Admin lozinka"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />

            <button className="rounded-xl bg-yellow-400 px-8 py-4 font-black text-black transition hover:bg-yellow-300">
              Uđi u admin
            </button>
          </form>
        </div>
      </main>
    );
  }

  const selectedTournamentData = tournaments.find(
    (t) => t.id === selectedTournament
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-4 inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
            Admin dashboard
          </p>

          <h1 className="text-5xl font-black text-yellow-400">Admin panel</h1>

          <p className="mt-3 max-w-2xl text-zinc-300">
            Upravljaj turnirima, prijavama, ždrijebom i rezultatima.
          </p>
        </div>

        <button
          onClick={logoutAdmin}
          className="rounded-xl border border-red-500/40 px-5 py-3 font-bold text-red-300 transition hover:bg-red-500/10"
        >
          Odjava admina
        </button>
      </div>

      <div className="mb-10 grid gap-4 md:grid-cols-5">
        <a
          href="/admin/novi-turnir"
          className="rounded-2xl border border-white/10 bg-zinc-950 p-6 font-bold transition hover:border-yellow-400 hover:bg-yellow-500/10"
        >
          <span className="block text-2xl text-yellow-300">+</span>
          Novi turnir
        </a>

        <a
          href="/admin"
          className="rounded-2xl border border-white/10 bg-zinc-950 p-6 font-bold transition hover:border-yellow-400 hover:bg-yellow-500/10"
        >
          <span className="block text-2xl text-yellow-300">{teams.length}</span>
          Prijave
        </a>

        <a
          href="/admin/zdrijeb"
          className="rounded-2xl border border-white/10 bg-zinc-950 p-6 font-bold transition hover:border-yellow-400 hover:bg-yellow-500/10"
        >
          <span className="block text-2xl text-yellow-300">🎲</span>
          Ždrijeb
        </a>

        <a
          href="/admin/rezultati"
          className="rounded-2xl border border-white/10 bg-zinc-950 p-6 font-bold transition hover:border-yellow-400 hover:bg-yellow-500/10"
        >
          <span className="block text-2xl text-yellow-300">🏆</span>
          Rezultati
        </a>

        <a
          href={
            selectedTournament
              ? `/admin/bracket/${selectedTournament}`
              : "/admin"
          }
          className="rounded-2xl border border-white/10 bg-zinc-950 p-6 font-bold transition hover:border-yellow-400 hover:bg-yellow-500/10"
        >
          <span className="block text-2xl text-yellow-300">🏁</span>
          Bracket
        </a>
      </div>

      <section className="rounded-3xl border border-white/10 bg-zinc-950/80 p-8">
        <h2 className="text-3xl font-black text-yellow-400">
          Prijave po turniru
        </h2>

        <p className="mt-2 text-zinc-400">
          Odaberi turnir i potvrdi ili odbij ekipe koje su se prijavile.
        </p>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold text-yellow-300">
            Odaberi turnir
          </label>

          <select
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
            className="input"
          >
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name} — {tournament.location}
              </option>
            ))}
          </select>
        </div>

        {selectedTournamentData && (
          <div className="mt-6 rounded-2xl bg-zinc-900 p-5">
            <p className="text-sm text-zinc-400">Trenutni turnir</p>

            <h3 className="mt-1 text-2xl font-bold text-yellow-300">
              {selectedTournamentData.name}
            </h3>

            <p className="text-zinc-400">
              {selectedTournamentData.location} ·{" "}
              {selectedTournamentData.starts_at}
            </p>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {loading && <p>Učitavam...</p>}

          {!loading && teams.length === 0 && (
            <div className="rounded-2xl bg-zinc-900 p-6">
              Nema prijavljenih ekipa za ovaj turnir.
            </div>
          )}

          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded-2xl border border-white/10 bg-zinc-900 p-6"
            >
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <h3 className="text-2xl font-bold text-yellow-300">
                    {team.name}
                  </h3>

                  <p className="text-zinc-400">{team.city}</p>

                  <p className="text-zinc-400">
                    Kapetan: {team.captain_name}
                  </p>

                  <p className="text-zinc-400">
                    Igrači: {team.player_one} / {team.player_two}
                  </p>

                  <p className="text-zinc-400">{team.phone}</p>

                  <p className="text-zinc-400">{team.email}</p>
                </div>

                <div className="flex flex-col gap-3">
                  <span
                    className={`rounded-full px-4 py-2 text-center font-bold ${
                      team.status === "approved"
                        ? "bg-green-500/20 text-green-300"
                        : team.status === "rejected"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-yellow-500/20 text-yellow-300"
                    }`}
                  >
                    {team.status}
                  </span>

                  <button
                    onClick={() => updateStatus(team.id, "approved")}
                    className="rounded-xl bg-green-500 px-5 py-2 font-bold text-black"
                  >
                    Potvrdi
                  </button>

                  <button
                    onClick={() => updateStatus(team.id, "rejected")}
                    className="rounded-xl bg-red-500 px-5 py-2 font-bold text-white"
                  >
                    Odbij
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}