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
      setSelectedTournament((current) =>
        current && data.some((t) => t.id === current) ? current : data[0].id
      );
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
    if (!isAdmin) return;

    loadTournaments();

    const channel = supabase
      .channel("admin-tournaments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => loadTournaments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedTournament) return;

    loadTeams(selectedTournament);

    const channel = supabase
      .channel(`admin-teams-${selectedTournament}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `tournament_id=eq.${selectedTournament}`
        },
        () => loadTeams(selectedTournament)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${selectedTournament}`
        },
        () => loadTeams(selectedTournament)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTournament]);

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <div className="card shadow-2xl">
          <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
            Admin pristup
          </p>

          <h1 className="text-4xl font-black text-[#f3dfad]">
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

            <button className="rounded-xl bg-[#d4b06a] px-8 py-4 font-black text-black transition hover:bg-[#f3dfad]">
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
    <main className="page">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
            Admin dashboard
          </p>

          <h1 className="text-4xl font-black text-[#f3dfad] sm:text-5xl">Admin panel</h1>

          <p className="mt-3 max-w-2xl text-zinc-300">
            Upravljaj turnirima, prijavama, ždrijebom i rezultatima.
          </p>
        </div>

        <button
          onClick={logoutAdmin}
          className="btn-danger"
        >
          Odjava admina
        </button>
      </div>

      <div className="mb-10 grid gap-4 md:grid-cols-2 lg:grid-cols-10">
        <a
          href="/admin/novi-turnir"
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">+</span>
          Novi turnir
        </a>

        <a
          href="/admin/uredi-turnir"
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">✏️</span>
          Uredi turnir
        </a>

        <a
          href="/admin"
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">{teams.length}</span>
          Prijave
        </a>

        <a
          href="/admin/zdrijeb"
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">🎲</span>
          Ždrijeb
        </a>

        <a
          href={selectedTournament ? `/tournament/${selectedTournament}` : "/admin"}
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">🏆</span>
          Rezultati
        </a>

        <a
          href={
            selectedTournament
              ? `/admin/bracket/${selectedTournament}`
              : "/admin"
          }
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">🏁</span>
          Bracket
        </a>

        <a
          href={selectedTournament ? `/dashboard/${selectedTournament}` : "/admin"}
          target={selectedTournament ? "_blank" : undefined}
          rel={selectedTournament ? "noopener noreferrer" : undefined}
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">📺</span>
          TV dashboard
        </a>

        <a
          href={selectedTournament ? `/liga/${selectedTournament}` : "/admin"}
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">📊</span>
          Liga prikaz
        </a>

        <a
          href="/admin/achievementi"
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">🏅</span>
          Achievementi
        </a>

        <a
          href={selectedTournament ? `/story/${selectedTournament}` : "/admin"}
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">📱</span>
          Story generator
        </a>
      </div>

      <section className="card">
        <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">
          Prijave po turniru
        </h2>

        <p className="mt-2 text-zinc-400">
          Odaberi turnir i potvrdi ili odbij ekipe koje su se prijavile.
        </p>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold text-[#d4b06a]">
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
          <div className="mt-6 rounded-2xl bg-[#12392b] p-5">
            <p className="text-sm text-zinc-400">Trenutni turnir</p>

            <h3 className="mt-1 text-xl font-bold text-[#d4b06a] sm:text-2xl">
              {selectedTournamentData.name}
            </h3>

            <p className="text-zinc-400">
              {selectedTournamentData.location} ·{" "}
              {selectedTournamentData.starts_at}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`/tournament/${selectedTournamentData.id}`}
                className="rounded-xl border border-[#d4b06a]/30 px-5 py-2 font-bold text-[#f3dfad] transition hover:bg-[#d4b06a]/10"
              >
                Otvori turnir
              </a>

              <a
                href={`/dashboard/${selectedTournamentData.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#d4b06a] px-5 py-2 font-black text-black transition hover:bg-[#f3dfad]"
              >
                Otvori TV dashboard
              </a>

              <a
                href={`/liga/${selectedTournamentData.id}`}
                className="rounded-xl border border-[#d4b06a]/30 px-5 py-2 font-bold text-[#f3dfad] transition hover:bg-[#d4b06a]/10"
              >
                Otvori liga prikaz
              </a>


              <a
                href={`/story/${selectedTournamentData.id}`}
                className="rounded-xl border border-[#d4b06a]/30 px-5 py-2 font-bold text-[#f3dfad] transition hover:bg-[#d4b06a]/10"
              >
                Story generator
              </a>

              <a
                href="/admin/achievementi"
                className="rounded-xl border border-[#d4b06a]/30 px-5 py-2 font-bold text-[#f3dfad] transition hover:bg-[#d4b06a]/10"
              >
                Achievementi
              </a>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {loading && <p>Učitavam...</p>}

          {!loading && teams.length === 0 && (
            <div className="rounded-2xl bg-[#12392b] p-6">
              Nema prijavljenih ekipa za ovaj turnir.
            </div>
          )}

          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded-2xl border border-[#d4b06a]/15 bg-[#12392b] p-6"
            >
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <h3 className="text-xl font-bold text-[#d4b06a] sm:text-2xl">
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
                        : "bg-[#d4b06a]/20 text-[#d4b06a]"
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