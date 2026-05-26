"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LiveMatchPage({
  params
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = use(params);

  const [match, setMatch] = useState<any>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [games, setGames] = useState<any[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`live-match-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_games",
          filter: `match_id=eq.${matchId}`
        },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`
        },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_sets",
          filter: `match_id=eq.${matchId}`
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  async function loadData() {
    const { data: matchData } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    setMatch(matchData);

    if (matchData?.tournament_id) {
      const { data: tournamentData } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", matchData.tournament_id)
        .maybeSingle();

      setTournament(tournamentData);
    }

    const { data: gameData } = await supabase
      .from("match_games")
      .select("*")
      .eq("match_id", matchId)
      .order("set_number", { ascending: true })
      .order("game_number", { ascending: true });

    setGames(gameData || []);

    const { data: setData } = await supabase
      .from("match_sets")
      .select("*")
      .eq("match_id", matchId)
      .order("set_number", { ascending: true });

    setSets(setData || []);

    setLoading(false);
  }

  const currentSet = match?.current_set || 1;
  const groupScoreLimit = tournament?.group_score_limit || tournament?.score_limit || 1001;
  const knockoutScoreLimit = tournament?.knockout_score_limit || tournament?.score_limit || 1001;
  const scoreLimit = match?.phase === "group" ? groupScoreLimit : knockoutScoreLimit;
  const legacyBestOf = Number(String(tournament?.match_format || "best_of_1").replace("best_of_", "")) || 1;
  const groupBestOf = Number(tournament?.group_best_of || 1);
  const knockoutBestOf = Number(tournament?.knockout_best_of || legacyBestOf || 1);
  const matchBestOf = match?.phase === "group" ? groupBestOf : knockoutBestOf;
  const setsToWin = Math.ceil(matchBestOf / 2);

  function prettyBestOf(bestOf: number) {
    if (bestOf === 5) return "do 3 pobjede";
    if (bestOf === 3) return "do 2 pobjede";
    return "jedna partija";
  }

  const currentSetGames = games.filter(
    (game) => Number(game.set_number) === Number(currentSet)
  );

  const totalA = useMemo(
    () =>
      currentSetGames.reduce(
        (sum, game) => sum + Number(game.team_a_total || 0),
        0
      ),
    [currentSetGames]
  );

  const totalB = useMemo(
    () =>
      currentSetGames.reduce(
        (sum, game) => sum + Number(game.team_b_total || 0),
        0
      ),
    [currentSetGames]
  );

  const lastGame = games[games.length - 1];

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p>Učitavam live rezultat...</p>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-red-300">
          Meč nije pronađen.
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="mb-10 text-center">
        <p className={`mb-4 inline-block rounded-full border px-4 py-2 text-sm font-bold ${match.status === "waiting" || match.status === "bye" ? "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" : match.status === "finished" ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {match.status === "waiting" || match.status === "bye" ? "● ZAKLJUČANO" : match.status === "finished" ? "● ZAVRŠENO" : "● LIVE"}
        </p>

        <h1 className="text-2xl font-black text-[#f3dfad] sm:text-3xl sm:text-4xl md:text-6xl">
          {match.team_a_name} vs {match.team_b_name}
        </h1>

        <p className="mt-3 text-zinc-300">
          Set {currentSet} · {match?.phase === "group" ? "grupa" : "knockout"} do {scoreLimit} · {prettyBestOf(matchBestOf)} · treba {setsToWin} set(ova)
        </p>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-[#d4b06a]/20 bg-[#0a2018] p-8 text-center">
          <p className="text-xl font-bold text-zinc-300">
            {match.team_a_name}
          </p>
          <p className="mt-5 text-7xl font-black text-[#f3dfad]">
            {totalA}
          </p>
          <p className="mt-3 text-zinc-500">
            Setovi: {match.sets_a || 0}
          </p>
        </div>

        <div className="rounded-3xl border border-[#d4b06a]/20 bg-[#0a2018] p-8 text-center">
          <p className="text-xl font-bold text-zinc-300">
            {match.team_b_name}
          </p>
          <p className="mt-5 text-7xl font-black text-[#f3dfad]">
            {totalB}
          </p>
          <p className="mt-3 text-zinc-500">
            Setovi: {match.sets_b || 0}
          </p>
        </div>
      </section>

      {lastGame && (
        <section className="mt-8 card">
          <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">
            Zadnje dijeljenje
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-[#12392b] p-5">
              <p className="font-bold text-[#d4b06a]">{match.team_a_name}</p>
              <p className="mt-2 text-3xl font-black">
                +{lastGame.team_a_total}
              </p>
              <p className="mt-2 text-sm text-zinc-400">Zadnji unos rezultata</p>
            </div>

            <div className="rounded-2xl bg-[#12392b] p-5">
              <p className="font-bold text-[#d4b06a]">{match.team_b_name}</p>
              <p className="mt-2 text-3xl font-black">
                +{lastGame.team_b_total}
              </p>
              <p className="mt-2 text-sm text-zinc-400">Zadnji unos rezultata</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className="rounded-full bg-blue-500/20 px-4 py-2 text-blue-300">
              Unos rezultata
            </span>

            <span
              className={`rounded-full px-4 py-2 ${
                lastGame.called_team_fell
                  ? "bg-red-500/20 text-red-300"
                  : "bg-green-500/20 text-green-300"
              }`}
            >
              Status: OK
            </span>
          </div>
        </section>
      )}

      {sets.length > 0 && (
        <section className="mt-8 card">
          <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">
            Završeni setovi
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {sets.map((set) => (
              <div key={set.id} className="rounded-2xl bg-[#12392b] p-5">
                <p className="text-sm text-zinc-400">
                  Set {set.set_number}
                </p>
                <p className="mt-2 text-xl font-black text-[#d4b06a] sm:text-2xl">
                  {set.team_a_score} : {set.team_b_score}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">
          Povijest dijeljenja
        </h2>

        <div className="mt-5 space-y-3">
          {games
            .slice()
            .reverse()
            .map((game) => (
              <div
                key={game.id}
                className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-5"
              >
                <p className="text-sm text-zinc-500">
                  Set {game.set_number} · Dijeljenje {game.game_number}
                </p>

                <div className="mt-2 flex flex-wrap justify-between gap-4">
                  <span className="font-bold">
                    {match.team_a_name}: +{game.team_a_total}
                  </span>
                  <span className="font-bold">
                    {match.team_b_name}: +{game.team_b_total}
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
            ))}
        </div>
      </section>
    </main>
  );
}