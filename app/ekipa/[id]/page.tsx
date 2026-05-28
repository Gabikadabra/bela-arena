"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TeamProfileParams = Promise<{ id: string }>;

export default function EkipaProfilePage({ params }: { params: TeamProfileParams }) {
  const { id } = use(params);

  const [team, setTeam] = useState<any>(null);
  const [statsRows, setStatsRows] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeamProfile();

    const channel = supabase
      .channel(`ekipa-profile-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `id=eq.${id}` }, () => loadTeamProfile(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => loadTeamProfile(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "match_games" }, () => loadTeamProfile(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "team_ranking_stats" }, () => loadTeamProfile(false))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function loadTeamProfile(showLoader = true) {
    if (showLoader) setLoading(true);

    const { data: teamData } = await supabase
      .from("teams")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    setTeam(teamData);

    const { data: tournamentData } = await supabase
      .from("tournaments")
      .select("*")
      .order("starts_at", { ascending: false });

    setTournaments(tournamentData || []);

    const { data: statData } = await supabase
      .from("team_ranking_stats")
      .select("*")
      .eq("team_id", id);

    setStatsRows(statData || []);

    const { data: matchData } = await supabase
      .from("matches")
      .select("*")
      .or(`team_a_id.eq.${id},team_b_id.eq.${id}`)
      .order("created_at", { ascending: false });

    setMatches(matchData || []);

    const matchIds = (matchData || []).map((match) => match.id);

    if (matchIds.length > 0) {
      const { data: gameData } = await supabase
        .from("match_games")
        .select("*")
        .in("match_id", matchIds)
        .order("created_at", { ascending: false });

      setGames(gameData || []);
    } else {
      setGames([]);
    }

    setLoading(false);
  }

  const tournamentById = useMemo(() => {
    return new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  }, [tournaments]);

  const profileStats = useMemo(() => {
    const finishedMatches = matches.filter((match) => match.status === "finished");
    const wins = finishedMatches.filter((match) => match.winner_id === id).length;
    const losses = finishedMatches.length - wins;
    const activeMatches = matches.filter((match) => match.status !== "finished").length;
    const totalPoints = statsRows.reduce((sum, row) => sum + Number(row.total_points || 0), 0);
    const totalDeclarations = statsRows.reduce((sum, row) => sum + Number(row.total_declarations || 0), 0);
    const bestSingleDeal = statsRows.reduce((best, row) => Math.max(best, Number(row.best_single_deal || 0)), 0);
    const bestSingleGameDeclarations = calculateBestSingleGameDeclarations(id, matches, games);
    const winrate = finishedMatches.length > 0 ? Math.round((wins / finishedMatches.length) * 100) : 0;
    const currentElo = calculateChessElo(id, finishedMatches);
    const lastFive = finishedMatches.slice(0, 5).map((match) => (match.winner_id === id ? "W" : "L"));

    return {
      activeMatches,
      bestSingleDeal,
      bestSingleGameDeclarations,
      currentElo,
      finishedMatches: finishedMatches.length,
      lastFive,
      losses,
      totalDeclarations,
      totalMatches: matches.length,
      totalPoints,
      wins,
      winrate,
    };
  }, [id, matches, statsRows, games]);

  if (loading) {
    return (
      <main className="page">
        <p className="text-zinc-300">Učitavam profil ekipe...</p>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="page">
        <div className="card">
          <h1 className="text-4xl font-black text-[#f3dfad]">Ekipa nije pronađena</h1>
          <p className="mt-4 text-zinc-300">Provjeri link ili odaberi ekipu iz rang-liste.</p>
          <a href="/rang-lista" className="mt-6 inline-flex btn-primary">Rang-lista</a>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
            Profil ekipe
          </p>
          <h1 className="text-4xl font-black text-[#f3dfad] sm:text-6xl">
            {team.name || team.team_name || "Ekipa bez imena"}
          </h1>
          <p className="mt-4 max-w-3xl text-zinc-300">
            Pregled ekipe, igrača, ELO-a, omjera pobjeda, rekordnih zvanja i zadnjih mečeva.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a href="/rang-lista" className="btn-outline">Rang-lista</a>
          {team.tournament_id && (
            <a href={`/tournament/${team.tournament_id}`} className="btn-primary">Turnir ekipe</a>
          )}
        </div>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ProfileStat title="ELO" value={profileStats.currentElo} sub="šahovski obračun po meču" />
        <ProfileStat title="Omjer" value={`${profileStats.wins}-${profileStats.losses}`} sub={`${profileStats.winrate}% pobjeda`} />
        <ProfileStat title="Mečevi" value={profileStats.totalMatches} sub={`${profileStats.activeMatches} aktivnih`} />
        <ProfileStat title="Zvanja / partija" value={profileStats.bestSingleGameDeclarations} sub="rekord u jednoj partiji" />
      </section>

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="card">
          <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Podaci ekipe</h2>

          <div className="mt-6 grid gap-3 text-zinc-300">
            <TeamInfo label="Naziv" value={team.name || team.team_name} />
            <TeamInfo label="Grad" value={team.city} />
            <TeamInfo label="Kapetan" value={team.captain_name || team.captain} />
            <TeamInfo label="Igrač 1" value={team.player_one || team.playerOne} />
            <TeamInfo label="Igrač 2" value={team.player_two || team.playerTwo} />
            <TeamInfo label="Partner email" value={team.partner_email} />
            <TeamInfo label="Telefon" value={team.phone} />
            <TeamInfo label="Status prijave" value={team.status} />
            <TeamInfo label="Poziv partneru" value={team.invite_status} />
          </div>
        </section>

        <section className="card">
          <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Statistika</h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ProfileStat title="Ukupno bodova" value={profileStats.totalPoints} sub="iz rang-liste" />
            <ProfileStat title="Ukupno zvanja" value={profileStats.totalDeclarations} sub="sve partije" />
            <ProfileStat title="Najbolje dijeljenje" value={profileStats.bestSingleDeal} sub="najviše bodova u dijeljenju" />
            <ProfileStat title="Forma" value={profileStats.lastFive.length ? profileStats.lastFive.join(" ") : "-"} sub="zadnjih 5 završenih mečeva" />
          </div>
        </section>
      </div>

      <section className="mt-8 card">
        <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Zadnji mečevi</h2>
        <p className="mt-2 text-zinc-400">Zadnji rezultati ove ekipe, s linkom na live prikaz ili unos rezultata.</p>

        <div className="mt-6 space-y-4">
          {matches.length === 0 && (
            <div className="card-soft text-zinc-300">Ova ekipa još nema mečeva.</div>
          )}

          {matches.slice(0, 12).map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              teamId={id}
              tournament={tournamentById.get(match.tournament_id)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function calculateBestSingleGameDeclarations(teamId: string, matches: any[], games: any[]) {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  let best = 0;

  for (const game of games) {
    const match = matchById.get(game.match_id);
    if (!match) continue;

    if (match.team_a_id === teamId) {
      best = Math.max(best, Number(game.team_a_declarations || 0));
    }

    if (match.team_b_id === teamId) {
      best = Math.max(best, Number(game.team_b_declarations || 0));
    }
  }

  return best;
}

function calculateChessElo(teamId: string, finishedMatches: any[]) {
  const eloMap = new Map<string, number>();

  const sortedMatches = [...finishedMatches].sort((a, b) => {
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  for (const match of sortedMatches) {
    const teamAId = match.team_a_id;
    const teamBId = match.team_b_id;

    if (!teamAId || !teamBId || !match.winner_id) continue;

    const eloA = eloMap.get(teamAId) || 1000;
    const eloB = eloMap.get(teamBId) || 1000;
    const resultA = match.winner_id === teamAId ? 1 : 0;
    const resultB = match.winner_id === teamBId ? 1 : 0;
    const changeA = Math.round(32 * (resultA - expectedScore(eloA, eloB)));
    const changeB = Math.round(32 * (resultB - expectedScore(eloB, eloA)));

    eloMap.set(teamAId, Math.max(100, eloA + changeA));
    eloMap.set(teamBId, Math.max(100, eloB + changeB));
  }

  return Math.round(eloMap.get(teamId) || 1000);
}

function expectedScore(teamElo: number, opponentElo: number) {
  return 1 / (1 + Math.pow(10, (opponentElo - teamElo) / 400));
}

function getScore(match: any, side: "a" | "b") {
  if (side === "a") {
    return match.team_a_score ?? match.score_a ?? match.points_a ?? match.result_a ?? 0;
  }

  return match.team_b_score ?? match.score_b ?? match.points_b ?? match.result_b ?? 0;
}

function ProfileStat({ title, value, sub }: { title: string; value: any; sub: string }) {
  return (
    <div className="rounded-3xl border border-[#d4b06a]/20 bg-[#0a2018] p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-2 text-3xl font-black text-[#f3dfad]">{value ?? 0}</p>
      <p className="mt-1 text-sm text-zinc-500">{sub}</p>
    </div>
  );
}

function TeamInfo({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <span className="text-sm font-bold text-[#d4b06a]">{label}</span>
      <span className="text-right text-sm text-zinc-200">{value || "-"}</span>
    </div>
  );
}

function MatchRow({ match, teamId, tournament }: { match: any; teamId: string; tournament?: any }) {
  const isTeamA = match.team_a_id === teamId;
  const opponentName = isTeamA ? match.team_b_name : match.team_a_name;
  const scoreFor = getScore(match, isTeamA ? "a" : "b");
  const scoreAgainst = getScore(match, isTeamA ? "b" : "a");
  const isFinished = match.status === "finished";
  const won = isFinished && match.winner_id === teamId;

  return (
    <div className="rounded-3xl border border-[#d4b06a]/15 bg-[#184332]/70 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-black text-[#f3dfad]">
            vs {opponentName || "Nepoznat protivnik"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {tournament?.name || "Turnir"} {match.group_name ? `• Grupa ${match.group_name}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full border px-4 py-2 text-sm font-bold ${won ? "border-green-500/30 bg-green-500/10 text-green-300" : isFinished ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-[#d4b06a]/20 bg-[#d4b06a]/10 text-[#d4b06a]"}`}>
            {isFinished ? (won ? "Pobjeda" : "Poraz") : match.status || "Čeka se"}
          </span>
          <span className="rounded-full border border-[#d4b06a]/20 bg-[#d4b06a]/10 px-4 py-2 text-sm font-black text-[#d4b06a]">
            {scoreFor} : {scoreAgainst}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <a href={`/live/${match.id}`} className="btn-outline">Live</a>
        {!isFinished && <a href={`/mec/${match.id}`} className="btn-primary">Upiši rezultat</a>}
      </div>
    </div>
  );
}
