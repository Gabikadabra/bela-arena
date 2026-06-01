"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RangListaPage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("all");
  const [stats, setStats] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [matchGames, setMatchGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("rang-lista-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => loadData(false),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => loadData(false),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_games" },
        () => loadData(false),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadData(showLoader = true) {
    if (showLoader) setLoading(true);

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

    const { data: gameData } = await supabase
      .from("match_games")
      .select(
        "id, match_id, set_number, team_a_declarations, team_b_declarations, team_a_macki, team_b_macki, created_at",
      )
      .order("created_at", { ascending: true });

    setMatchGames(gameData || []);
    setLoading(false);
  }

  const filteredStats = useMemo(() => {
    const base =
      selectedTournament === "all"
        ? mergeGlobalStats(stats)
        : stats.filter((s) => s.tournament_id === selectedTournament);

    const matchEloMap = calculateMatchByMatchElo(
      base,
      matches,
      selectedTournament,
    );

    return base
      .map((team) => {
        const eloData = matchEloMap.get(team.team_id) || {
          elo: 1000,
          totalEloChange: 0,
          averageOpponentElo: 1000,
          lastMatchChange: 0,
        };

        return {
          ...team,
          elo: eloData.elo,
          total_elo_change: eloData.totalEloChange,
          average_opponent_elo: eloData.averageOpponentElo,
          last_match_elo_change: eloData.lastMatchChange,
          streak: calculateStreak(team.team_id, matches, selectedTournament),
          best_single_set_declarations: calculateBestSingleSetDeclarations(
            team.team_id,
            matches,
            matchGames,
            selectedTournament,
          ),
          macki_count: calculateMackiCount(
            team.team_id,
            matches,
            matchGames,
            selectedTournament,
          ),
        };
      })
      .sort((a, b) => b.elo - a.elo);
  }, [stats, matches, matchGames, selectedTournament]);

  const topElo = filteredStats[0];
  const topPoints = [...filteredStats].sort(
    (a, b) => Number(b.total_points) - Number(a.total_points),
  )[0];
  const topSingleSetDeclarations = [...filteredStats].sort(
    (a, b) =>
      Number(b.best_single_set_declarations) -
      Number(a.best_single_set_declarations),
  )[0];
  const topStreak = [...filteredStats].sort(
    (a, b) => Number(b.streak) - Number(a.streak),
  )[0];
  const topMacki = [...filteredStats].sort(
    (a, b) => Number(b.macki_count || 0) - Number(a.macki_count || 0),
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

        <h1 className="text-4xl font-black text-[#f3dfad] sm:text-5xl">
          Rang lista
        </h1>

        <p className="mt-4 max-w-2xl text-zinc-300">
          ELO, pobjede, bodovi, mački, rekord zvanja u jednom setu, streakovi i
          najbolji rezultati.
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

      <section className="mb-8 rounded-3xl border border-[#d4b06a]/15 bg-[#0a2018] p-6">
        <h2 className="text-2xl font-black text-[#f3dfad]">
          Kako ELO funkcionira?
        </h2>
        <p className="mt-3 max-w-4xl text-zinc-300">
          ELO radi kao u šahu: svaka ekipa kreće od 1000, a svaka utakmica
          mijenja ELO prema tvojoj snazi i snazi protivnika prije te utakmice.
          Ne gleda se samo je li protivnik jak, nego koliko je jak u odnosu na
          tebe. Zato ista pobjeda ne vrijedi uvijek isto.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <InfoBox title="Start" text="Svaka ekipa počinje s 1000 ELO." />
          <InfoBox
            title="Pobjeda"
            text="Pobjeda protiv jače ekipe diže puno više nego pobjeda protiv slabije."
          />
          <InfoBox
            title="Poraz"
            text="Poraz od slabije ekipe skida više, a poraz od jače skida manje."
          />
          <InfoBox
            title="Protivnik"
            text="U svakoj utakmici uspoređuje se tvoj ELO i ELO protivnika prije tog meča."
          />
          <InfoBox
            title="Omjer snage"
            text="Ako si puno slabiji i pobijediš, dobiješ puno. Ako si puno jači i pobijediš, dobiješ malo."
          />
        </div>
        <p className="mt-4 rounded-2xl border border-[#d4b06a]/15 bg-[#184332]/60 p-4 text-sm text-zinc-300">
          Formula u aplikaciji po svakoj utakmici:{" "}
          <span className="font-bold text-[#f3dfad]">
            očekivani rezultat = 1 / (1 + 10^((ELO protivnika - moj ELO) /
            400)), promjena = 32 × (rezultat - očekivani rezultat)
          </span>
          . Rezultat je 1 za pobjedu i 0 za poraz. Ovo znači da se protivnikova
          snaga uvijek gleda u odnosu na tvoju snagu. Ako imaš 1000 ELO i
          pobijediš ekipu od 1200 ELO, dobiješ puno više nego da pobijediš ekipu
          od 800 ELO. Ako si favorit i izgubiš od slabije ekipe, izgubiš puno
          više nego protiv jače ekipe.
        </p>
      </section>

      <section className="mb-6 rounded-3xl border border-[#d4b06a]/15 bg-[#0a2018] p-6">
        <h2 className="text-2xl font-black text-[#f3dfad]">Achievementi</h2>
        <p className="mt-2 text-zinc-400">
          Na profilima ekipa sada se automatski prikazuju medalje kao Prva
          pobjeda, Neporaženi, ELO majstor, Kraljevi zvanja, Iskusna ekipa i
          Forma u naletu.
        </p>
      </section>

      <section className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
          title="Rekord zvanja u jednom setu"
          value={topSingleSetDeclarations?.team_name || "-"}
          sub={`Ekipa ima ${topSingleSetDeclarations?.best_single_set_declarations || 0} zvanja u jednom setu`}
        />
        <Highlight
          title="Najveći streak"
          value={topStreak?.team_name || "-"}
          sub={`${topStreak?.streak || 0} pobjeda zaredom`}
        />
        <Highlight
          title="Najviše mački"
          value={topMacki?.team_name || "-"}
          sub={`${topMacki?.macki_count || 0} puta bez primljenog štiha`}
        />
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#d4b06a]/15 bg-[#184332]/85">
        <div className="grid grid-cols-[70px_1.5fr_repeat(9,1fr)] gap-2 border-b border-[#d4b06a]/15 bg-[#d4b06a]/10 p-4 text-sm font-black text-[#d4b06a] max-xl:hidden">
          <div>#</div>
          <div>Ekipa</div>
          <div>ELO</div>
          <div>Mečevi</div>
          <div>W</div>
          <div>L</div>
          <div>Win%</div>
          <div>Bodovi</div>
          <div>Zvanja / set</div>
          <div>Mački</div>
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
              className="grid gap-3 p-4 text-zinc-200 xl:grid-cols-[70px_1.5fr_repeat(9,1fr)] xl:items-center"
            >
              <div className="text-2xl font-black text-[#f3dfad] sm:text-3xl">
                #{index + 1}
              </div>

              <div>
                <a
                  href={`/ekipa/${team.team_id}`}
                  className="text-xl font-black text-[#d4b06a] hover:text-[#f3dfad]"
                >
                  {team.team_name}
                </a>
                <p className="text-sm text-zinc-500">
                  Najbolje dijeljenje: {team.best_single_deal || 0}
                </p>
              </div>

              <Stat
                label="ELO"
                value={`${team.elo} (${formatLastMatchChange(team.last_match_elo_change)})`}
              />
              <Stat label="Mečevi" value={team.matches_played} />
              <Stat label="W" value={team.wins} />
              <Stat label="L" value={team.losses} />
              <Stat label="Win%" value={`${team.winrate}%`} />
              <Stat label="Bodovi" value={team.total_points} />
              <Stat
                label="Zvanja / set"
                value={team.best_single_set_declarations}
              />
              <Stat label="Mački" value={team.macki_count || 0} />
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
      best_single_deal: 0,
      macki_count: 0,
    };

    current.matches_played += Number(row.matches_played || 0);
    current.wins += Number(row.wins || 0);
    current.losses += Number(row.losses || 0);
    current.total_points += Number(row.total_points || 0);
    current.total_declarations += Number(row.total_declarations || 0);
    current.best_single_deal = Math.max(
      Number(current.best_single_deal || 0),
      Number(row.best_single_deal || 0),
    );
    current.macki_count += Number(row.macki_count || 0);

    map.set(row.team_id, current);
  }

  return Array.from(map.values()).map((team) => {
    const winrate =
      team.matches_played > 0
        ? Number(((team.wins / team.matches_played) * 100).toFixed(1))
        : 0;

    const elo = 1000;

    return {
      ...team,
      winrate,
      elo,
    };
  });
}

function calculateMatchByMatchElo(
  teams: any[],
  matches: any[],
  selectedTournament: string,
) {
  const teamIds = new Set(teams.map((team) => team.team_id));
  const eloMap = new Map<string, number>();
  const opponentEloSums = new Map<string, number>();
  const opponentCounts = new Map<string, number>();
  const totalEloChange = new Map<string, number>();
  const lastMatchChange = new Map<string, number>();

  for (const team of teams) {
    eloMap.set(team.team_id, 1000);
    opponentEloSums.set(team.team_id, 0);
    opponentCounts.set(team.team_id, 0);
    totalEloChange.set(team.team_id, 0);
    lastMatchChange.set(team.team_id, 0);
  }

  const finishedMatches = matches
    .filter((match) => {
      const inTournament =
        selectedTournament === "all" ||
        match.tournament_id === selectedTournament;

      return (
        inTournament &&
        match.status === "finished" &&
        match.winner_id &&
        teamIds.has(match.team_a_id) &&
        teamIds.has(match.team_b_id)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(
        a.finished_at || a.updated_at || a.created_at || 0,
      ).getTime();
      const dateB = new Date(
        b.finished_at || b.updated_at || b.created_at || 0,
      ).getTime();
      return dateA - dateB;
    });

  for (const match of finishedMatches) {
    const teamAId = match.team_a_id;
    const teamBId = match.team_b_id;
    const eloA = eloMap.get(teamAId) || 1000;
    const eloB = eloMap.get(teamBId) || 1000;
    const resultA = match.winner_id === teamAId ? 1 : 0;
    const resultB = match.winner_id === teamBId ? 1 : 0;

    const expectedA = calculateExpectedScore(eloA, eloB);
    const expectedB = calculateExpectedScore(eloB, eloA);
    const changeA = Math.round(32 * (resultA - expectedA));
    const changeB = Math.round(32 * (resultB - expectedB));

    eloMap.set(teamAId, Math.max(100, eloA + changeA));
    eloMap.set(teamBId, Math.max(100, eloB + changeB));

    opponentEloSums.set(teamAId, (opponentEloSums.get(teamAId) || 0) + eloB);
    opponentEloSums.set(teamBId, (opponentEloSums.get(teamBId) || 0) + eloA);
    opponentCounts.set(teamAId, (opponentCounts.get(teamAId) || 0) + 1);
    opponentCounts.set(teamBId, (opponentCounts.get(teamBId) || 0) + 1);
    totalEloChange.set(
      teamAId,
      (totalEloChange.get(teamAId) || 0) + Math.round(changeA),
    );
    totalEloChange.set(
      teamBId,
      (totalEloChange.get(teamBId) || 0) + Math.round(changeB),
    );
    lastMatchChange.set(teamAId, changeA);
    lastMatchChange.set(teamBId, changeB);
  }

  const result = new Map<
    string,
    {
      elo: number;
      totalEloChange: number;
      averageOpponentElo: number;
      lastMatchChange: number;
    }
  >();

  for (const team of teams) {
    const count = opponentCounts.get(team.team_id) || 0;
    const averageOpponentElo =
      count > 0
        ? Math.round((opponentEloSums.get(team.team_id) || 0) / count)
        : 1000;

    result.set(team.team_id, {
      elo: Math.round(eloMap.get(team.team_id) || 1000),
      totalEloChange: Math.round(totalEloChange.get(team.team_id) || 0),
      averageOpponentElo,
      lastMatchChange: Math.round(lastMatchChange.get(team.team_id) || 0),
    });
  }

  return result;
}

function calculateExpectedScore(teamElo: number, opponentElo: number) {
  return 1 / (1 + Math.pow(10, (opponentElo - teamElo) / 400));
}

function formatLastMatchChange(value: number) {
  if (!value) return "zadnji meč ±0";

  return value > 0 ? `zadnji meč +${value}` : `zadnji meč ${value}`;
}

function calculateBestSingleSetDeclarations(
  teamId: string,
  matches: any[],
  matchGames: any[],
  selectedTournament: string,
) {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const declarationsBySet = new Map<string, number>();

  for (const game of matchGames) {
    const match = matchById.get(game.match_id);

    if (!match) continue;

    const inTournament =
      selectedTournament === "all" ||
      match.tournament_id === selectedTournament;

    if (!inTournament) continue;

    const setNumber = Number(game.set_number || 1);
    const key = `${game.match_id}-${setNumber}`;

    if (match.team_a_id === teamId) {
      declarationsBySet.set(
        key,
        (declarationsBySet.get(key) || 0) +
          Number(game.team_a_declarations || 0),
      );
    }

    if (match.team_b_id === teamId) {
      declarationsBySet.set(
        key,
        (declarationsBySet.get(key) || 0) +
          Number(game.team_b_declarations || 0),
      );
    }
  }

  return Math.max(0, ...Array.from(declarationsBySet.values()));
}

function calculateMackiCount(
  teamId: string,
  matches: any[],
  matchGames: any[],
  selectedTournament: string,
) {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  let count = 0;

  for (const game of matchGames) {
    const match = matchById.get(game.match_id);
    if (!match) continue;

    const inTournament =
      selectedTournament === "all" ||
      match.tournament_id === selectedTournament;

    if (!inTournament) continue;

    if (match.team_a_id === teamId && game.team_a_macki) count += 1;
    if (match.team_b_id === teamId && game.team_b_macki) count += 1;
  }

  return count;
}

function calculateStreak(
  teamId: string,
  matches: any[],
  selectedTournament: string,
) {
  const relevant = matches.filter((match) => {
    const inTournament =
      selectedTournament === "all" ||
      match.tournament_id === selectedTournament;

    const played = match.team_a_id === teamId || match.team_b_id === teamId;

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
  sub,
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

function InfoBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[#d4b06a]/15 bg-[#184332]/60 p-4">
      <p className="font-black text-[#d4b06a]">{title}</p>
      <p className="mt-1 text-sm text-zinc-300">{text}</p>
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
