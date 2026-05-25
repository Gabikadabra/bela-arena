"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RangListaPage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("all");
  const [stats, setStats] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: tournamentData } = await supabase
      .from("tournaments")
      .select("*")
      .order("starts_at", { ascending: false });

    setTournaments(tournamentData || []);

    const { data: statData } = await supabase
      .from("team_ranking_stats")
      .select("*")
      .order("elo", { ascending: false });

    setStats(statData || []);

    const { data: matchData } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "finished")
      .order("created_at", { ascending: true });

    setMatches(matchData || []);
    setLoading(false);
  }

  const filteredStats = useMemo(() => {
    const base =
      selectedTournament === "all"
        ? mergeGlobalStats(stats)
        : stats.filter((s) => s.tournament_id === selectedTournament);

    return base
      .map((team) => ({
        ...team,
        streak: calculateStreak(team.team_id, matches, selectedTournament)
      }))
      .sort((a, b) => b.elo - a.elo);
  }, [stats, matches, selectedTournament]);

  const topElo = filteredStats[0];
  const topPoints = [...filteredStats].sort(
    (a, b) => Number(b.total_points) - Number(a.total_points)
  )[0];
  const topDeclarations = [...filteredStats].sort(
    (a, b) => Number(b.total_declarations) - Number(a.total_declarations)
  )[0];
  const topStreak = [...filteredStats].sort(
    (a, b) => Number(b.streak) - Number(a.streak)
  )[0];

  if (loading) {
    return (
      <main className="page">
        <p className="text-zinc-300">Učitavam rang listu...</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="mb-10">
        <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
          Bela Arena statistika
        </p>

        <h1 className="text-4xl font-black text-[#f3dfad] sm:text-5xl">Rang lista</h1>

        <p className="mt-4 max-w-2xl text-zinc-300">
          ELO, pobjede, bodovi, zvanja, streakovi i najbolji rezultati.
        </p>
      </div>

      <section className="mb-8 rounded-3xl border border-[#d4b06a]/15 bg-[#184332]/85 p-6">
        <label className="mb-2 block text-sm font-bold text-[#d4b06a]">
          Filter po turniru
        </label>

        <select
          value={selectedTournament}
          onChange={(e) => setSelectedTournament(e.target.value)}
          className="input"
        >
          <option value="all">Svi turniri</option>
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.name} — {tournament.location}
            </option>
          ))}
        </select>
      </section>

      <section className="mb-10 grid gap-4 md:grid-cols-4">
        <Highlight
          title="Najveći ELO"
          value={topElo?.team_name || "-"}
          sub={`${topElo?.elo || 0} ELO`}
        />
        <Highlight
          title="Najviše bodova"
          value={topPoints?.team_name || "-"}
          sub={`${topPoints?.total_points || 0} bodova`}
        />
        <Highlight
          title="Najviše zvanja"
          value={topDeclarations?.team_name || "-"}
          sub={`${topDeclarations?.total_declarations || 0} zvanja`}
        />
        <Highlight
          title="Najveći streak"
          value={topStreak?.team_name || "-"}
          sub={`${topStreak?.streak || 0} pobjeda zaredom`}
        />
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#d4b06a]/15 bg-[#184332]/85">
        <div className="grid grid-cols-[70px_1.5fr_repeat(8,1fr)] gap-2 border-b border-[#d4b06a]/15 bg-[#d4b06a]/10 p-4 text-sm font-black text-[#d4b06a] max-xl:hidden">
          <div>#</div>
          <div>Ekipa</div>
          <div>ELO</div>
          <div>Mečevi</div>
          <div>W</div>
          <div>L</div>
          <div>Win%</div>
          <div>Bodovi</div>
          <div>Zvanja</div>
          <div>Streak</div>
        </div>

        <div className="divide-y divide-white/10">
          {filteredStats.length === 0 && (
            <div className="p-8 text-zinc-300">
              Još nema dovoljno završenih mečeva za rang listu.
            </div>
          )}

          {filteredStats.map((team, index) => (
            <div
              key={`${team.team_id}-${team.tournament_id || "global"}`}
              className="grid gap-3 p-4 text-zinc-200 xl:grid-cols-[70px_1.5fr_repeat(8,1fr)] xl:items-center"
            >
              <div className="text-2xl font-black text-[#f3dfad] sm:text-3xl">
                #{index + 1}
              </div>

              <div>
                <p className="text-xl font-black text-[#d4b06a]">
                  {team.team_name}
                </p>
                <p className="text-sm text-zinc-500">
                  Najbolje dijeljenje: {team.best_single_deal || 0}
                </p>
              </div>

              <Stat label="ELO" value={team.elo} />
              <Stat label="Mečevi" value={team.matches_played} />
              <Stat label="W" value={team.wins} />
              <Stat label="L" value={team.losses} />
              <Stat label="Win%" value={`${team.winrate}%`} />
              <Stat label="Bodovi" value={team.total_points} />
              <Stat label="Zvanja" value={team.total_declarations} />
              <Stat label="Streak" value={team.streak} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function mergeGlobalStats(stats: any[]) {
  const map = new Map();

  for (const row of stats) {
    const current = map.get(row.team_id) || {
      team_id: row.team_id,
      team_name: row.team_name,
      tournament_id: "all",
      matches_played: 0,
      wins: 0,
      losses: 0,
      total_points: 0,
      total_declarations: 0,
      best_single_deal: 0
    };

    current.matches_played += Number(row.matches_played || 0);
    current.wins += Number(row.wins || 0);
    current.losses += Number(row.losses || 0);
    current.total_points += Number(row.total_points || 0);
    current.total_declarations += Number(row.total_declarations || 0);
    current.best_single_deal = Math.max(
      Number(current.best_single_deal || 0),
      Number(row.best_single_deal || 0)
    );

    map.set(row.team_id, current);
  }

  return Array.from(map.values()).map((team) => {
    const winrate =
      team.matches_played > 0
        ? Number(((team.wins / team.matches_played) * 100).toFixed(1))
        : 0;

    const elo =
      1000 +
      team.wins * 35 -
      team.losses * 15 +
      Math.floor(team.total_points / 100) +
      Math.floor(team.total_declarations / 50);

    return {
      ...team,
      winrate,
      elo
    };
  });
}

function calculateStreak(
  teamId: string,
  matches: any[],
  selectedTournament: string
) {
  const relevant = matches.filter((match) => {
    const inTournament =
      selectedTournament === "all" || match.tournament_id === selectedTournament;

    const played =
      match.team_a_id === teamId || match.team_b_id === teamId;

    return inTournament && played;
  });

  let streak = 0;

  for (let i = relevant.length - 1; i >= 0; i--) {
    if (relevant[i].winner_id === teamId) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function Highlight({
  title,
  value,
  sub
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-3xl border border-[#d4b06a]/20 bg-[#0a2018] p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-2 text-2xl font-black text-[#f3dfad]">{value}</p>
      <p className="mt-1 text-zinc-400">{sub}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 xl:hidden">{label}</p>
      <p className="font-bold">{value || 0}</p>
    </div>
  );
}