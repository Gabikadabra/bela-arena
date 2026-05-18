"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminBracketPage({
  params
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);

  const [tournament, setTournament] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  async function loadData() {
    const { data: tournamentData } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .maybeSingle();

    setTournament(tournamentData);

    const { data: matchData } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("phase", "knockout")
      .order("round", { ascending: true })
      .order("match_number", { ascending: true });

    setMatches(matchData || []);
  }

  const rounds = useMemo(() => {
    return matches.reduce((acc: any, match: any) => {
      const round = match.round || match.round_number || 1;
      if (!acc[round]) acc[round] = [];
      acc[round].push(match);
      return acc;
    }, {});
  }, [matches]);

  function getWinnerName(match: any) {
    if (!match.winner_id) return null;
    if (match.winner_id === match.team_a_id) return match.team_a_name;
    if (match.winner_id === match.team_b_id) return match.team_b_name;
    return "Pobjednik";
  }

  async function autoAdvance() {
    setMessage("");

    const finished = matches.filter((m) => m.status === "finished" && m.winner_id);

    let updated = 0;

    for (const match of finished) {
      const currentRound = match.round || match.round_number || 1;
      const nextRound = currentRound + 1;
      const nextMatchNumber = Math.ceil(match.match_number / 2);
      const nextSlot = match.match_number % 2 === 1 ? "A" : "B";

      const nextMatch = matches.find(
        (m) =>
          (m.round || m.round_number || 1) === nextRound &&
          m.match_number === nextMatchNumber
      );

      if (!nextMatch) continue;

      const winnerName = getWinnerName(match);

      if (nextSlot === "A") {
        if (nextMatch.team_a_id === match.winner_id) continue;

        await supabase
          .from("matches")
          .update({
            team_a_id: match.winner_id,
            team_a_name: winnerName,
            status:
              nextMatch.team_b_id || nextMatch.team_b_name !== "Pobjednik čeka"
                ? "scheduled"
                : "waiting"
          })
          .eq("id", nextMatch.id);

        updated++;
      } else {
        if (nextMatch.team_b_id === match.winner_id) continue;

        await supabase
          .from("matches")
          .update({
            team_b_id: match.winner_id,
            team_b_name: winnerName,
            status:
              nextMatch.team_a_id || nextMatch.team_a_name !== "Pobjednik čeka"
                ? "scheduled"
                : "waiting"
          })
          .eq("id", nextMatch.id);

        updated++;
      }
    }

    setMessage(
      updated > 0
        ? `Auto advance odradio ${updated} promjena.`
        : "Nema novih pobjednika za prebaciti dalje."
    );

    loadData();
  }

  return (
    <main className="page">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="badge">
            Admin bracket
          </p>

          <h1 className="page-title">
            {tournament?.name || "Bracket"}
          </h1>

          <p className="mt-3 text-zinc-300">
            Knockout prikaz, live linkovi i automatsko prebacivanje pobjednika dalje.
          </p>
        </div>

        <button
          onClick={autoAdvance}
          className="btn-primary"
        >
          Auto advance winnera
        </button>
      </div>

      {message && (
        <div className="mb-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-yellow-300">
          {message}
        </div>
      )}

      <div className="overflow-x-auto pb-6">
        <div className="flex min-w-max gap-6">
          {Object.entries(rounds).map(([round, roundMatches]: any) => (
            <div key={round} className="w-80 shrink-0">
              <h2 className="mb-5 text-2xl font-black text-yellow-400">
                {roundTitle(Number(round))}
              </h2>

              <div className="space-y-6">
                {roundMatches.map((match: any) => (
                  <BracketMatch
                    key={match.id}
                    match={match}
                    winnerName={getWinnerName(match)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function BracketMatch({
  match,
  winnerName
}: {
  match: any;
  winnerName: string | null;
}) {
  const isFinished = match.status === "finished";
  const isLive = match.status === "scheduled";

  return (
    <div className="relative rounded-2xl border border-white/10 bg-zinc-950 p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          Meč {match.match_number}
        </p>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            isFinished
              ? "bg-green-500/20 text-green-300"
              : isLive
              ? "bg-yellow-500/20 text-yellow-300"
              : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {match.status}
        </span>
      </div>

      <TeamRow
        name={match.team_a_name || match.team_a_seed || "Čeka"}
        score={match.score_a}
        winner={match.winner_id === match.team_a_id}
      />

      <TeamRow
        name={match.team_b_name || match.team_b_seed || "Čeka"}
        score={match.score_b}
        winner={match.winner_id === match.team_b_id}
      />

      {winnerName && (
        <p className="mt-3 rounded-xl bg-green-500/10 p-3 text-sm font-bold text-green-300">
          Winner: {winnerName}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <a
          href={`/live/${match.id}`}
          className="flex-1 rounded-xl border border-yellow-500/30 px-3 py-2 text-center text-sm font-bold text-yellow-300 transition hover:bg-yellow-500/10"
        >
          Live
        </a>

        <a
          href={`/mec/${match.id}`}
          className="btn-primary flex-1 text-sm"
        >
          Blok
        </a>
      </div>
    </div>
  );
}

function TeamRow({
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
      className={`mb-2 flex items-center justify-between rounded-xl p-3 ${
        winner
          ? "bg-green-500/20 text-green-300"
          : "bg-zinc-900 text-zinc-200"
      }`}
    >
      <span className="font-bold">{name}</span>
      <span className="font-black">{score || 0}</span>
    </div>
  );
}

function roundTitle(round: number) {
  if (round === 1) return "Prvo kolo";
  if (round === 2) return "Drugo kolo";
  if (round === 3) return "Treće kolo";
  if (round === 4) return "Polufinale / kasna faza";
  if (round === 5) return "Finalna faza";
  return `Runda ${round}`;
}