"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{ tournamentId: string }>;
};

function sortStandings(rows: any[]) {
  return [...rows].sort((a, b) => {
    return (
      Number(b.table_points || 0) - Number(a.table_points || 0) ||
      Number(b.wins || 0) - Number(a.wins || 0) ||
      Number(b.points_diff || 0) - Number(a.points_diff || 0) ||
      Number(b.points_for || 0) - Number(a.points_for || 0) ||
      String(a.team_name || "").localeCompare(String(b.team_name || ""), "hr")
    );
  });
}

function statusInfo(match: any) {
  const status = String(match?.status || "scheduled");
  const resultStatus = String(match?.result_status || "");

  if (status === "finished") {
    return { label: "ZAVRŠENO", className: "border-green-400/40 bg-green-500/15 text-green-300" };
  }

  if (resultStatus === "submitted") {
    return { label: "ČEKA POTVRDU", className: "border-yellow-300/40 bg-yellow-400/15 text-yellow-200" };
  }

  if (status === "waiting" || status === "bye") {
    return { label: "ZAKLJUČANO", className: "border-zinc-400/30 bg-zinc-500/15 text-zinc-300" };
  }

  if (status === "active" || status === "live") {
    return { label: "LIVE", className: "border-red-400/40 bg-red-500/15 text-red-300" };
  }

  return { label: "ČEKA", className: "border-[#d4b06a]/40 bg-[#d4b06a]/15 text-[#f3dfad]" };
}

function phaseLabel(phase: string) {
  if (phase === "group") return "Grupa";
  if (phase === "round_robin") return "Liga";
  if (phase === "knockout") return "Knockout";
  return phase || "Meč";
}

export default function TournamentDashboardPage({ params }: PageProps) {
  const { tournamentId } = use(params);

  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    loadData();

    const clock = window.setInterval(() => setNow(new Date()), 1000);

    const channel = supabase
      .channel(`tv-dashboard-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` },
        () => loadData(false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_standings", filter: `tournament_id=eq.${tournamentId}` },
        () => loadData(false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${tournamentId}` },
        () => loadData(false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_games" },
        () => loadData(false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` },
        () => loadData(false)
      )
      .subscribe();

    return () => {
      window.clearInterval(clock);
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  async function loadData(showLoader = true) {
    if (showLoader) setLoading(true);

    const { data: tournamentData } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .maybeSingle();

    const { data: teamData } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });

    const { data: matchData } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("phase", { ascending: true })
      .order("group_name", { ascending: true })
      .order("round", { ascending: true })
      .order("bracket_position", { ascending: true });

    const { data: standingData } = await supabase
      .from("group_standings")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("group_name", { ascending: true });

    const matchIds = (matchData || []).map((match) => match.id);

    let gameData: any[] = [];

    if (matchIds.length > 0) {
      const { data } = await supabase
        .from("match_games")
        .select("*")
        .in("match_id", matchIds)
        .order("created_at", { ascending: false })
        .limit(1000);

      gameData = data || [];
    }

    setTournament(tournamentData);
    setTeams(teamData || []);
    setMatches(matchData || []);
    setStandings(standingData || []);
    setGames(gameData);
    setLoading(false);
  }

  const approvedTeams = teams.filter((team) => team.status === "approved");
  const finishedMatches = matches.filter((match) => match.status === "finished");
  const activeMatches = matches.filter((match) => ["active", "live", "scheduled"].includes(String(match.status || "")));
  const waitingMatches = matches.filter((match) => ["waiting", "bye"].includes(String(match.status || "")));
  const submittedMatches = matches.filter((match) => match.result_status === "submitted" && match.status !== "finished");
  const comebackHighlights = useMemo(() => calculateComebackHighlights(matches, games), [matches, games]);

  const progress = matches.length > 0 ? Math.round((finishedMatches.length / matches.length) * 100) : 0;

  const groupedStandings = useMemo(() => {
    return standings.reduce((acc: Record<string, any[]>, row) => {
      const groupName = row.group_name || "Bez grupe";
      if (!acc[groupName]) acc[groupName] = [];
      acc[groupName].push(row);
      return acc;
    }, {});
  }, [standings]);

  const topTables = Object.entries(groupedStandings).map(([groupName, rows]) => ({
    groupName,
    rows: sortStandings(rows as any[]).slice(0, 6)
  }));

  if (loading) {
    return (
      <main className="min-h-screen bg-[#061710] p-8 text-white">
        <div className="rounded-3xl border border-[#d4b06a]/20 bg-[#0a2018] p-10 text-2xl font-black text-[#f3dfad]">
          Učitavam TV dashboard...
        </div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="min-h-screen bg-[#061710] p-8 text-white">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-10 text-2xl font-black text-red-300">
          Turnir nije pronađen.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#061710] p-4 text-white sm:p-6 lg:p-8">
      <section className="mb-6 rounded-[2rem] border border-[#d4b06a]/20 bg-gradient-to-br from-[#0a2018] to-[#12392b] p-6 shadow-2xl lg:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-black uppercase tracking-[0.3em] text-red-300">
              Live dashboard
            </p>
            <h1 className="text-4xl font-black text-[#f3dfad] lg:text-6xl">{tournament.name}</h1>
            <p className="mt-3 text-xl text-white/65">
              {tournament.location || "Lokacija nije unesena"} · {tournament.starts_at || "Datum nije unesen"}
            </p>
          </div>

          <div className="text-left lg:text-right">
            <p className="text-4xl font-black text-[#d4b06a] lg:text-6xl">
              {now.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="mt-2 text-white/55">Automatsko osvježavanje preko realtimea</p>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat title="Ekipe" value={approvedTeams.length} />
        <Stat title="Mečevi" value={matches.length} />
        <Stat title="Završeno" value={finishedMatches.length} />
        <Stat title="Napredak" value={`${progress}%`} />
        <Stat title="Čeka potvrdu" value={submittedMatches.length} warning />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Panel title="Trenutni / sljedeći mečevi" subtitle="Najbitnije za projektor ili TV u dvorani.">
            <div className="grid gap-4 lg:grid-cols-2">
              {activeMatches.slice(0, 8).map((match) => (
                <DashboardMatch key={match.id} match={match} highlight />
              ))}

              {activeMatches.length === 0 && (
                <p className="rounded-2xl bg-[#12392b] p-5 text-white/60">Nema aktivnih ili otključanih mečeva.</p>
              )}
            </div>
          </Panel>

          {topTables.length > 0 && (
            <Panel title="Tablice grupa" subtitle="Prikaz prvih 6 ekipa po grupi.">
              <div className="grid gap-4 lg:grid-cols-2">
                {topTables.map((group) => (
                  <GroupMiniTable key={group.groupName} groupName={group.groupName} rows={group.rows} />
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Zadnji rezultati" subtitle="Zadnjih nekoliko završenih mečeva.">
            <div className="space-y-3">
              {finishedMatches.slice(-8).reverse().map((match) => (
                <DashboardMatch key={match.id} match={match} compact />
              ))}

              {finishedMatches.length === 0 && (
                <p className="rounded-2xl bg-[#12392b] p-5 text-white/60">Još nema završenih mečeva.</p>
              )}
            </div>
          </Panel>

          <Panel title="Najveći comebackovi" subtitle="Računa se iz unosa po dijeljenjima: najveći minus iz kojeg je ekipa pobijedila.">
            <div className="space-y-3">
              {comebackHighlights.slice(0, 5).map((row) => (
                <a key={row.matchId} href={`/live/${row.matchId}`} className="block rounded-2xl border border-green-400/20 bg-green-500/10 p-4 hover:border-green-300/50">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-green-300">+{row.comeback} comeback</p>
                  <p className="mt-2 text-lg font-black text-[#f3dfad]">{row.winnerName}</p>
                  <p className="text-sm text-white/60">protiv {row.opponentName} · konačno {row.finalScore}</p>
                </a>
              ))}

              {comebackHighlights.length === 0 && (
                <p className="rounded-2xl bg-[#12392b] p-5 text-white/60">Još nema dovoljno unosa po dijeljenjima za comeback statistiku.</p>
              )}
            </div>
          </Panel>

          {games.length > 0 && (
            <Panel title="Zadnja dijeljenja" subtitle="Uživo iz unosa rezultata.">
              <div className="space-y-3">
                {games.slice(0, 12).map((game) => {
                  const match = matches.find((item) => item.id === game.match_id);

                  return (
                    <div key={game.id} className="rounded-2xl border border-[#d4b06a]/10 bg-[#12392b] p-4">
                      <p className="text-sm text-white/45">
                        {match?.team_a_name || "Ekipa A"} vs {match?.team_b_name || "Ekipa B"} · Set {game.set_number || 1} · Dijeljenje {game.game_number || "?"}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3 text-lg font-black">
                        <span>{game.team_a_total || 0} : {game.team_b_total || 0}</span>
                        <span className={game.called_team_fell ? "text-red-300" : "text-green-300"}>
                          {game.called_team_fell ? "PAD" : "OK"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {waitingMatches.length > 0 && (
            <Panel title="Zaključano / čeka" subtitle="Mečevi koji čekaju prethodni uvjet.">
              <div className="space-y-3">
                {waitingMatches.slice(0, 6).map((match) => (
                  <DashboardMatch key={match.id} match={match} compact />
                ))}
              </div>
            </Panel>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ title, value, warning, danger }: { title: string; value: any; warning?: boolean; danger?: boolean }) {
  const valueClass = danger ? "text-red-300" : warning ? "text-yellow-200" : "text-[#f3dfad]";

  return (
    <div className="rounded-3xl border border-[#d4b06a]/15 bg-[#0a2018] p-5 shadow-xl">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-white/45">{title}</p>
      <p className={`mt-3 text-4xl font-black ${valueClass}`}>{value}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-[#d4b06a]/15 bg-[#0a2018]/95 p-5 shadow-2xl lg:p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-black text-[#f3dfad] lg:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1 text-white/50">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function DashboardMatch({ match, compact, highlight }: { match: any; compact?: boolean; highlight?: boolean }) {
  const status = statusInfo(match);
  const winnerA = match.winner_id && match.winner_id === match.team_a_id;
  const winnerB = match.winner_id && match.winner_id === match.team_b_id;

  return (
    <a
      href={match.status === "waiting" || match.status === "bye" ? undefined : `/live/${match.id}`}
      className={`block rounded-3xl border p-4 transition ${
        highlight
          ? "border-[#d4b06a]/25 bg-[#12392b] hover:border-[#f3dfad]"
          : "border-[#d4b06a]/10 bg-[#12392b]/80 hover:border-[#d4b06a]/35"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-white/45">
          {match.table_number ? `Stol ${match.table_number} · ` : ""}
          {match.group_name ? `${match.group_name} · ` : ""}
          {phaseLabel(match.phase)} {match.round ? `· Runda ${match.round}` : ""}
        </p>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${status.className}`}>{status.label}</span>
      </div>

      <TeamRow name={match.team_a_name || match.team_a_seed || "Čeka se ekipa"} score={match.score_a} winner={winnerA} compact={compact} />
      <TeamRow name={match.team_b_name || match.team_b_seed || "Čeka se ekipa"} score={match.score_b} winner={winnerB} compact={compact} />

      {match.admin_note && <p className="mt-3 rounded-2xl bg-black/20 p-3 text-sm text-yellow-100">Napomena: {match.admin_note}</p>}
    </a>
  );
}

function TeamRow({ name, score, winner, compact }: { name: string; score: any; winner?: boolean; compact?: boolean }) {
  return (
    <div className={`mb-2 flex items-center justify-between rounded-2xl px-4 ${compact ? "py-2" : "py-3"} ${winner ? "bg-green-500/15 text-green-300" : "bg-black/20 text-white"}`}>
      <span className={`${compact ? "text-base" : "text-xl"} font-black`}>{name}</span>
      <span className={`${compact ? "text-xl" : "text-3xl"} font-black text-[#d4b06a]`}>{Number(score || 0)}</span>
    </div>
  );
}

function GroupMiniTable({ groupName, rows }: { groupName: string; rows: any[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#d4b06a]/10 bg-[#12392b]">
      <h3 className="bg-[#d4b06a]/10 p-4 text-xl font-black text-[#d4b06a]">{groupName}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-black/20 text-white/45">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Ekipa</th>
              <th className="p-3">P</th>
              <th className="p-3">W</th>
              <th className="p-3">Bod</th>
              <th className="p-3">+/-</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || row.team_id} className="border-t border-[#d4b06a]/10">
                <td className="p-3 font-black text-white/50">{index + 1}</td>
                <td className="p-3 font-black text-[#f3dfad]">{row.team_name}</td>
                <td className="p-3">{row.played || 0}</td>
                <td className="p-3">{row.wins || 0}</td>
                <td className="p-3 font-black text-[#d4b06a]">{row.table_points || 0}</td>
                <td className="p-3">{row.points_diff || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function calculateComebackHighlights(matches: any[], games: any[]) {
  const gamesByMatch = groupGamesByMatch(games);
  const highlights: any[] = [];

  for (const match of matches) {
    if (match.status !== "finished" || !match.winner_id) continue;

    const matchGames = gamesByMatch.get(match.id) || [];
    if (matchGames.length === 0) continue;

    const winnerIsA = match.winner_id === match.team_a_id;
    const winnerName = winnerIsA ? match.team_a_name : match.team_b_name;
    const opponentName = winnerIsA ? match.team_b_name : match.team_a_name;
    let scoreA = 0;
    let scoreB = 0;
    let comeback = 0;

    for (const game of sortMatchGames(matchGames)) {
      scoreA += getGameTotal(game, "a");
      scoreB += getGameTotal(game, "b");

      const deficit = winnerIsA ? scoreB - scoreA : scoreA - scoreB;
      comeback = Math.max(comeback, deficit);
    }

    if (comeback > 0) {
      highlights.push({
        matchId: match.id,
        comeback,
        winnerName: winnerName || "Pobjednička ekipa",
        opponentName: opponentName || "protivnik",
        finalScore: `${scoreA}:${scoreB}`,
      });
    }
  }

  return highlights.sort((a, b) => b.comeback - a.comeback);
}

function groupGamesByMatch(games: any[]) {
  const grouped = new Map<string, any[]>();

  for (const game of games || []) {
    if (!game.match_id) continue;
    const rows = grouped.get(game.match_id) || [];
    rows.push(game);
    grouped.set(game.match_id, rows);
  }

  return grouped;
}

function sortMatchGames(games: any[]) {
  return [...games].sort((a, b) => {
    return (
      Number(a.set_number || 0) - Number(b.set_number || 0) ||
      Number(a.game_number || 0) - Number(b.game_number || 0) ||
      new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );
  });
}

function getGameTotal(game: any, side: "a" | "b") {
  if (side === "a") {
    return Number(game.team_a_total ?? game.team_a_points ?? game.score_a ?? 0);
  }

  return Number(game.team_b_total ?? game.team_b_points ?? game.score_b ?? 0);
}
