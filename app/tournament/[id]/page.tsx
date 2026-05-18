"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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
          table: "match_games"
        },
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
      .order("round", { ascending: true })
      .order("bracket_position", { ascending: true });

    setMatches(matchData || []);

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
    (match) => match.status === "scheduled" || match.status === "waiting"
  );

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

  if (loading) {
    return (
      <main className="page">
        <p className="text-zinc-300">Učitavam turnir...</p>
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
      <section className="mb-10 card shadow-2xl">
        <p className="mb-4 inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
          Javni turnir
        </p>

        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div>
            <h1 className="text-4xl font-black text-yellow-400 sm:text-5xl">
              {tournament.name}
            </h1>

            <p className="mt-4 text-lg text-zinc-300">
              {tournament.location} ·{" "}
              {tournament.starts_at || "Datum nije unesen"}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Badge label={`Status: ${tournament.status}`} />
              <Badge label={`Igra se do ${tournament.score_limit || 1001}`} />
              <Badge label={formatType(tournament.tournament_format)} />
              <Badge label={formatMatch(tournament.match_format)} />
              <Badge
                label={`Repešaž: ${
                  tournament.has_repechage ? "Da" : "Ne"
                }`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {tournament.status === "open" && (
              <a
                href="/prijava"
                className="rounded-xl bg-yellow-400 px-6 py-3 text-center font-black text-black transition hover:bg-yellow-300"
              >
                Prijavi ekipu
              </a>
            )}

            <a
              href="/turniri"
              className="rounded-xl border border-yellow-500/40 px-6 py-3 text-center font-bold text-yellow-300 transition hover:bg-yellow-500/10"
            >
              Svi turniri
            </a>
          </div>
        </div>

        {tournament.rules && (
          <div className="mt-8 card-soft text-zinc-300">
            <b className="text-yellow-300">Pravila:</b>
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

      {liveMatches.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-black text-yellow-400 sm:text-3xl">
            Live / aktivni mečevi
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} live />
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-2xl font-black text-yellow-400 sm:text-3xl">Ekipe</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {approvedTeams.length === 0 && (
            <div className="rounded-2xl bg-zinc-950 p-6 text-zinc-300">
              Još nema potvrđenih ekipa.
            </div>
          )}

          {approvedTeams.map((team) => (
            <div
              key={team.id}
              className="rounded-2xl border border-white/10 bg-zinc-950 p-5"
            >
              <h3 className="font-bold text-yellow-300">{team.name}</h3>
              <p className="text-sm text-zinc-400">{team.city}</p>
            </div>
          ))}
        </div>
      </section>

      {Object.keys(groupedKnockout).length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-black text-yellow-400 sm:text-3xl">Bracket</h2>

          <div className="mt-5 overflow-x-auto pb-5">
            <div className="flex min-w-max gap-5">
              {Object.entries(groupedKnockout).map(
                ([round, roundMatches]: any) => (
                  <div key={round} className="w-80 shrink-0">
                    <h3 className="mb-4 text-xl font-bold text-yellow-300">
                      Runda {round}
                    </h3>

                    <div className="space-y-4">
                      {roundMatches.map((match: any) => (
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
          <h2 className="text-2xl font-black text-yellow-400 sm:text-3xl">
            Završeni mečevi
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {finishedMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {games.length > 0 && (
        <section>
          <h2 className="text-2xl font-black text-yellow-400 sm:text-3xl">
            Zadnja dijeljenja
          </h2>

          <div className="mt-5 space-y-3">
            {games.slice(0, 10).map((game) => {
              const match = matches.find((m) => m.id === game.match_id);

              return (
                <div
                  key={game.id}
                  className="rounded-2xl border border-white/10 bg-zinc-950 p-5"
                >
                  <p className="text-sm text-zinc-500">
                    {match?.team_a_name} vs {match?.team_b_name} · Set{" "}
                    {game.set_number} · Dijeljenje {game.game_number}
                  </p>

                  <div className="mt-2 flex flex-wrap justify-between gap-4">
                    <span className="font-bold">
                      {match?.team_a_name}: +{game.team_a_total}
                    </span>
                    <span className="font-bold">
                      {match?.team_b_name}: +{game.team_b_total}
                    </span>
                    <span
                      className={
                        game.called_team_fell
                          ? "text-red-300"
                          : "text-green-300"
                      }
                    >
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
  return (
    <span className="rounded-full bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-300">
      {label}
    </span>
  );
}

function Info({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-2 text-4xl font-black text-yellow-400">{value}</p>
    </div>
  );
}

function MatchCard({ match, live }: { match: any; live?: boolean }) {
  const winnerA = match.winner_id && match.winner_id === match.team_a_id;
  const winnerB = match.winner_id && match.winner_id === match.team_b_id;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
      <div className="mb-3 flex justify-between gap-3">
        <p className="text-sm text-zinc-500">
          Meč {match.bracket_position || match.match_number}
        </p>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            match.status === "finished"
              ? "bg-green-500/20 text-green-300"
              : live
              ? "bg-red-500/20 text-red-300"
              : "bg-yellow-500/20 text-yellow-300"
          }`}
        >
          {live ? "LIVE" : match.status}
        </span>
      </div>

      <TeamLine
        name={match.team_a_name || match.team_a_seed || "Čeka"}
        score={match.score_a}
        winner={winnerA}
      />

      <TeamLine
        name={match.team_b_name || match.team_b_seed || "Čeka"}
        score={match.score_b}
        winner={winnerB}
      />

      <div className="mt-4 flex gap-3">
        <a
          href={`/live/${match.id}`}
          className="flex-1 rounded-xl border border-yellow-500/40 px-4 py-2 text-center font-bold text-yellow-300 transition hover:bg-yellow-500/10"
        >
          Live
        </a>
      </div>
    </div>
  );
}

function TeamLine({
  name,
  score,
  winner
}: {
  name: string;
  score: number;
  winner: boolean;
}) {
  return (
    <div
      className={`mb-2 flex justify-between rounded-xl p-3 ${
        winner ? "bg-green-500/20 text-green-300" : "bg-zinc-900 text-zinc-200"
      }`}
    >
      <span className="font-bold">{name}</span>
      <span className="font-black">{score || 0}</span>
    </div>
  );
}