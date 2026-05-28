"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

function buildQualification(rows: any[], knockoutSize = 16) {
  const grouped = rows.reduce((acc: any, row: any) => {
    const groupName = row.group_name || "Bez grupe";
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(row);
    return acc;
  }, {});

  const sortedGroups = Object.fromEntries(
    Object.entries(grouped)
      .sort(([a], [b]) => String(a).localeCompare(String(b), "hr"))
      .map(([groupName, groupRows]: any) => [groupName, sortStandings(groupRows)])
  );

  const groupEntries = Object.entries(sortedGroups) as [string, any[]][];
  const groupCount = groupEntries.length || 1;
  const directPerGroup = Math.max(1, Math.floor(knockoutSize / groupCount));
  const directQualifiers: any[] = [];

  groupEntries.forEach(([groupName, groupRows]) => {
    groupRows.slice(0, directPerGroup).forEach((row, index) => {
      directQualifiers.push({
        ...row,
        qualification_type: "direct",
        qualification_label: `${index + 1}. u ${groupName}`
      });
    });
  });

  const remaining = Math.max(0, knockoutSize - directQualifiers.length);
  const extraQualifiers = groupEntries
    .flatMap(([groupName, groupRows]) =>
      groupRows.slice(directPerGroup).map((row) => ({
        ...row,
        qualification_type: "extra",
        qualification_label: `Najbolji dodatni (${groupName})`
      }))
    )
    .sort((a, b) => sortStandings([a, b])[0] === a ? -1 : 1)
    .slice(0, remaining);

  const qualifiers = [...directQualifiers, ...extraQualifiers].slice(0, knockoutSize);

  return {
    sortedGroups,
    qualifiers,
    qualifierIds: new Set(qualifiers.map((row) => row.team_id)),
    extraIds: new Set(extraQualifiers.map((row) => row.team_id))
  };
}

export default function TournamentPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`public-tournament-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${id}`
        },
        () => loadData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_standings",
          filter: `tournament_id=eq.${id}`
        },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${id}` },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${id}` },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_games" },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_sets" },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function loadData() {
    const { data: tournamentData } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    setTournament(tournamentData);

    const { data: teamData } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", id)
      .order("created_at", { ascending: true });

    setTeams(teamData || []);

    const { data: matchData } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", id)
      .order("phase", { ascending: true })
      .order("group_name", { ascending: true })
      .order("round", { ascending: true })
      .order("bracket_position", { ascending: true });

    setMatches(matchData || []);

    const { data: standingData } = await supabase
      .from("group_standings")
      .select("*")
      .eq("tournament_id", id)
      .order("group_name", { ascending: true });

    setStandings(standingData || []);

    const matchIds = (matchData || []).map((m) => m.id);

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

  function formatType(type: string) {
    if (type === "knockout") return "Knockout";
    if (type === "groups_knockout") return "Grupe + knockout";
    if (type === "round_robin") return "Round robin";
    return type || "Nije definirano";
  }

  function formatMatch(format: string) {
    if (format === "best_of_1") return "Jedna partija";
    if (format === "best_of_3") return "Do 2 pobjede";
    if (format === "best_of_5") return "Do 3 pobjede";
    return format || "Nije definirano";
  }

  const approvedTeams = teams.filter((team) => team.status === "approved");

  const liveMatches = matches.filter(
    (match) => match.status === "scheduled" || match.status === "active" || match.status === "live"
  );

  const lockedMatches = matches.filter((match) => match.status === "waiting");

  const finishedMatches = matches.filter((match) => match.status === "finished");

  const groupedKnockout = useMemo(() => {
    return matches
      .filter((match) => match.phase === "knockout")
      .reduce((acc: any, match: any) => {
        const round = match.round || 1;
        if (!acc[round]) acc[round] = [];
        acc[round].push(match);
        return acc;
      }, {});
  }, [matches]);

  const qualification = useMemo(
    () => buildQualification(standings, Number(tournament?.knockout_size || 16)),
    [standings, tournament?.knockout_size]
  );

  if (loading) {
    return (
      <main className="page">
        <div className="card">
          <p className="muted">Učitavam turnir...</p>
        </div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="page">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-red-300">
          Turnir nije pronađen.
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero-card mb-10">
        <span className="badge">Javni turnir</span>

        <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div>
            <h1 className="page-title">{tournament.name}</h1>

            <p className="muted mt-4 text-lg">
              {tournament.location} · {tournament.starts_at || "Datum nije unesen"}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Badge label={`Status: ${tournament.status}`} />
              <Badge label={`Igra se do ${tournament.score_limit || 1001}`} />
              <Badge label={formatType(tournament.tournament_format)} />
              <Badge label={formatMatch(tournament.match_format)} />
              <Badge label={`Repešaž: ${tournament.has_repechage ? "Da" : "Ne"}`} />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {tournament.status === "open" && (
              <a href="/prijava" className="btn-primary">
                Prijavi ekipu
              </a>
            )}

            <a href={`/dashboard/${id}`} target="_blank" rel="noopener noreferrer" className="btn-primary">
              TV dashboard
            </a>

            <a href="/turniri" className="btn-outline">
              Svi turniri
            </a>
          </div>
        </div>

        {tournament.rules && (
          <div className="mt-8 card-soft muted">
            <b className="text-[#d4b06a]">Pravila:</b>
            <p className="mt-2">{tournament.rules}</p>
          </div>
        )}
      </section>

      <section className="mb-10 grid gap-4 md:grid-cols-4">
        <Info title="Prijavljene ekipe" value={teams.length} />
        <Info title="Potvrđene ekipe" value={approvedTeams.length} />
        <Info title="Mečevi" value={matches.length} />
        <Info title="Završeni mečevi" value={finishedMatches.length} />
      </section>

      {Object.keys(qualification.sortedGroups).length > 0 && (
        <section className="mb-10">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="section-title">Tablice grupa</h2>
              <p className="muted mt-2">
                Poredak se sortira po bodovima, pobjedama, razlici i postignutim bodovima. Oznaka pokazuje tko trenutno prolazi dalje.
              </p>
            </div>
            <span className="badge">
              {qualification.qualifiers.length}/{Number(tournament?.knockout_size || 16)} prolazi
            </span>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {Object.entries(qualification.sortedGroups).map(([groupName, rows]: any) => (
              <GroupTable
                key={groupName}
                groupName={groupName}
                rows={rows}
                qualifierIds={qualification.qualifierIds}
                extraIds={qualification.extraIds}
              />
            ))}
          </div>
        </section>
      )}

      {liveMatches.length > 0 && (
        <section className="mb-10">
          <h2 className="section-title">Live / aktivni mečevi</h2>
          <p className="muted mt-2">
            Prikazuju se samo trenutno otključani mečevi. Zaključane Berger runde nisu live.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} live />
            ))}
          </div>
        </section>
      )}

      {lockedMatches.length > 0 && (
        <section className="mb-10">
          <h2 className="section-title">Zaključani mečevi</h2>
          <p className="muted mt-2">
            Ovi mečevi čekaju da se završi prethodna Berger runda.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {lockedMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="section-title">Ekipe</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {approvedTeams.length === 0 && (
            <div className="card-soft muted">Još nema potvrđenih ekipa.</div>
          )}

          {approvedTeams.map((team) => (
            <div key={team.id} className="card-soft">
              <h3 className="font-bold text-[#d4b06a]">{team.name}</h3>
              <p className="text-sm text-white/60">{team.city || "Grad nije upisan"}</p>
            </div>
          ))}
        </div>
      </section>

      {Object.keys(groupedKnockout).length > 0 && (
        <section className="mb-10">
          <h2 className="section-title">Bracket</h2>

          <div className="mt-5 overflow-x-auto pb-5">
            <div className="flex min-w-max gap-5">
              {Object.entries(groupedKnockout).map(
                ([round, roundMatches]: any) => (
                  <div key={round} className="w-80 shrink-0">
                    <h3 className="mb-4 text-xl font-bold text-[#d4b06a]">
                      Runda {round}
                    </h3>

                    <div className="space-y-4">
                      {roundMatches
                        .sort((a: any, b: any) => Number(a.bracket_position || 0) - Number(b.bracket_position || 0))
                        .map((match: any) => (
                          <MatchCard key={match.id} match={match} />
                        ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      )}

      {finishedMatches.length > 0 && (
        <section className="mb-10">
          <h2 className="section-title">Završeni mečevi</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {finishedMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {games.length > 0 && (
        <section>
          <h2 className="section-title">Zadnja dijeljenja</h2>

          <div className="mt-5 space-y-3">
            {games.slice(0, 10).map((game) => {
              const match = matches.find((m) => m.id === game.match_id);

              return (
                <div key={game.id} className="card-soft">
                  <p className="text-sm text-white/45">
                    {match?.team_a_name} vs {match?.team_b_name} · Set {game.set_number} · Dijeljenje {game.game_number}
                  </p>

                  <div className="mt-2 flex flex-wrap justify-between gap-4">
                    <span className="font-bold">{match?.team_a_name}: +{game.team_a_total}</span>
                    <span className="font-bold">{match?.team_b_name}: +{game.team_b_total}</span>
                    <span className={game.called_team_fell ? "text-red-300" : "text-green-300"}>
                      {game.called_team_fell ? "PAD" : "OK"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="badge">{label}</span>;
}

function Info({ title, value }: { title: string; value: any }) {
  return (
    <div className="stat-card">
      <p className="text-sm text-white/60">{title}</p>
      <p className="mt-2 text-4xl font-black text-[#f3dfad]">{value}</p>
    </div>
  );
}

function GroupTable({
  groupName,
  rows,
  qualifierIds,
  extraIds
}: {
  groupName: string;
  rows: any[];
  qualifierIds: Set<string>;
  extraIds: Set<string>;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#d4b06a]/15 bg-[#0a2018]/90 shadow-2xl">
      <h3 className="bg-[#d4b06a]/10 p-4 text-xl font-black text-[#d4b06a]">{groupName}</h3>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-[#061710]/65 text-white/55">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Ekipa</th>
              <th className="p-3">P</th>
              <th className="p-3">W</th>
              <th className="p-3">L</th>
              <th className="p-3">Bod</th>
              <th className="p-3">+/-</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row: any, index: number) => {
              const qualified = qualifierIds.has(row.team_id);
              const extra = extraIds.has(row.team_id);

              return (
                <tr key={row.id || row.team_id} className={`border-t border-[#d4b06a]/10 ${qualified ? "bg-[#d4b06a]/10" : ""}`}>
                  <td className="p-3 font-black text-white/60">{index + 1}</td>
                  <td className="p-3 font-black">
                    <a href={`/ekipa/${row.team_id}`} className="text-[#f3dfad] hover:text-[#d4b06a]">
                      {row.team_name}
                    </a>
                  </td>
                  <td className="p-3">{row.played}</td>
                  <td className="p-3">{row.wins}</td>
                  <td className="p-3">{row.losses}</td>
                  <td className="p-3 font-black text-[#d4b06a]">{row.table_points}</td>
                  <td className="p-3">{row.points_diff}</td>
                  <td className="p-3">
                    {qualified ? (
                      <span className="rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/15 px-3 py-1 text-xs font-black text-[#f3dfad]">
                        {extra ? "Najbolji dodatni" : "Prolazi"}
                      </span>
                    ) : (
                      <span className="text-white/35">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchCard({ match, live }: { match: any; live?: boolean }) {
  const winnerA = match.winner_id && match.winner_id === match.team_a_id;
  const winnerB = match.winner_id && match.winner_id === match.team_b_id;
  const locked = match.status === "waiting" || match.status === "bye";
  const finished = match.status === "finished";
  const statusLabel = finished ? "Završeno" : locked ? "Zaključano" : live ? "LIVE" : match.status;
  const statusClass = finished
    ? "bg-green-500/20 text-green-300"
    : locked
      ? "bg-zinc-500/20 text-zinc-300"
      : live
        ? "bg-red-500/20 text-red-300"
        : "bg-[#d4b06a]/20 text-[#d4b06a]";

  return (
    <div className="card-soft">
      <div className="mb-3 flex justify-between gap-3">
        <p className="text-sm text-white/45">
          {match.group_name ? `${match.group_name} · ` : ""}
          {(match.phase === "group" || match.phase === "round_robin") && match.round ? `Runda ${match.round} · ` : ""}
          Meč {match.bracket_position || match.match_number}
        </p>

        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      <TeamLine name={match.team_a_name || match.team_a_seed || "Čeka"} score={match.score_a} winner={winnerA} teamId={match.team_a_id} />
      <TeamLine name={match.team_b_name || match.team_b_seed || "Čeka"} score={match.score_b} winner={winnerB} teamId={match.team_b_id} />

      <div className="mt-4 flex gap-3">
        {locked ? (
          <button disabled className="btn-outline flex-1 cursor-not-allowed opacity-50">
            Čeka prethodnu rundu
          </button>
        ) : (
          <a href={`/live/${match.id}`} className="btn-outline flex-1">
            Live
          </a>
        )}
      </div>
    </div>
  );
}

function TeamLine({
  name,
  score,
  winner,
  teamId
}: {
  name: string;
  score: number;
  winner: boolean;
  teamId?: string;
}) {
  const content = <span className="font-bold">{name}</span>;

  return (
    <div className={`mb-2 flex justify-between rounded-xl p-3 ${winner ? "bg-green-500/20 text-green-300" : "bg-[#12392b] text-zinc-200"}`}>
      {teamId ? (
        <a href={`/ekipa/${teamId}`} className="font-bold hover:text-[#d4b06a]">
          {name}
        </a>
      ) : (
        content
      )}
      <span className="font-black">{score || 0}</span>
    </div>
  );
}
