"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  generateKnockoutMatches,
  generateRoundRobinMatches,
  generateGroups,
  generateGroupsKnockoutSeeds,
  recommendFormat,
  calculateRoundRobinMatchCount
} from "@/lib/bracketEngine";

export default function ZdrijebAdminPage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      loadTournamentData();
    }
  }, [selectedTournament]);

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

  async function loadTournamentData() {
    const { data: tournamentData } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", selectedTournament)
      .single();

    setTournament(tournamentData);

    const { data: teamData } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", selectedTournament)
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    setTeams(teamData || []);

    const { data: matchData } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", selectedTournament)
      .order("phase", { ascending: true })
      .order("group_name", { ascending: true })
      .order("round", { ascending: true })
      .order("bracket_position", { ascending: true });

    setMatches(matchData || []);

    const { data: standingData } = await supabase
      .from("group_standings")
      .select("*")
      .eq("tournament_id", selectedTournament)
      .order("group_name", { ascending: true })
      .order("team_name", { ascending: true });

    setStandings(standingData || []);
  }

  async function clearOldDraw() {
    if (!selectedTournament) return;

    const { data: matchIds } = await supabase
      .from("matches")
      .select("id")
      .eq("tournament_id", selectedTournament);

    if (matchIds && matchIds.length > 0) {
      const ids = matchIds.map((m) => m.id);

      await supabase.from("match_games").delete().in("match_id", ids);
      await supabase.from("match_sets").delete().in("match_id", ids);
    }

    await supabase
      .from("matches")
      .delete()
      .eq("tournament_id", selectedTournament);

    await supabase
      .from("group_standings")
      .delete()
      .eq("tournament_id", selectedTournament);
  }

  async function generateDraw() {
    setMessage("");

    if (!tournament) {
      setMessage("Odaberi turnir.");
      return;
    }

    if (teams.length < 2) {
      setMessage("Trebaš barem 2 potvrđene ekipe.");
      return;
    }

    try {
      await clearOldDraw();

      if (tournament.tournament_format === "knockout") {
        const generated = generateKnockoutMatches(selectedTournament, teams);

        const { data: insertedMatches, error } = await supabase
          .from("matches")
          .insert(generated)
          .select("*");

        if (error) throw error;

        const byeWinners = insertedMatches.filter(
          (m) =>
            m.round === 1 &&
            ((m.team_a_id && !m.team_b_id) ||
              (!m.team_a_id && m.team_b_id))
        );

        for (const match of byeWinners) {
          const winnerId = match.team_a_id || match.team_b_id;
          const winnerName = match.team_a_name || match.team_b_name;

          const nextMatch = insertedMatches.find(
            (m) =>
              m.phase === "knockout" &&
              m.round === 2 &&
              m.bracket_position === Math.ceil(match.bracket_position / 2)
          );

          if (!nextMatch) continue;

          const nextSlot = match.bracket_position % 2 === 1 ? "A" : "B";

          if (nextSlot === "A") {
            await supabase
              .from("matches")
              .update({
                team_a_id: winnerId,
                team_a_name: winnerName,
                status: nextMatch.team_b_id ? "scheduled" : "waiting"
              })
              .eq("id", nextMatch.id);
          } else {
            await supabase
              .from("matches")
              .update({
                team_b_id: winnerId,
                team_b_name: winnerName,
                status: nextMatch.team_a_id ? "scheduled" : "waiting"
              })
              .eq("id", nextMatch.id);
          }

          await supabase
            .from("matches")
            .update({
              winner_id: winnerId,
              status: "finished"
            })
            .eq("id", match.id);
        }

        setMessage("Knockout bracket je generiran.");
      } else if (tournament.tournament_format === "round_robin") {
        const generated = generateRoundRobinMatches(selectedTournament, teams);

        const { error } = await supabase.from("matches").insert(generated);
        if (error) throw error;

        setMessage("Round robin raspored je generiran.");
      } else if (tournament.tournament_format === "groups_knockout") {
        const groupSize = tournament.group_size || 4;
        const knockoutSize = tournament.knockout_size || 16;

        const generatedGroups = generateGroups(
          selectedTournament,
          teams,
          groupSize
        );

        const generatedKnockout = generateGroupsKnockoutSeeds(
          selectedTournament,
          knockoutSize
        );

        const { error: standingsError } = await supabase
          .from("group_standings")
          .insert(generatedGroups.standings);

        if (standingsError) throw standingsError;

        const { error: matchesError } = await supabase
          .from("matches")
          .insert([...generatedGroups.matches, ...generatedKnockout]);

        if (matchesError) throw matchesError;

        setMessage("Grupe + knockout su generirani.");
      }

      await supabase
        .from("tournaments")
        .update({ status: "live" })
        .eq("id", selectedTournament);

      await loadTournamentData();
    } catch (error: any) {
      setMessage("Greška: " + error.message);
    }
  }

  const recommended = recommendFormat(teams.length);

  const groupedStandings = standings.reduce((acc: any, row: any) => {
    if (!acc[row.group_name]) acc[row.group_name] = [];
    acc[row.group_name].push(row);
    return acc;
  }, {});

  const groupMatches = matches.filter((m) => m.phase === "group");
  const knockoutMatches = matches.filter((m) => m.phase === "knockout");
  const roundRobinMatches = matches.filter((m) => m.phase === "round_robin");

  const groupedKnockout = knockoutMatches.reduce((acc: any, match: any) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-10">
        <p className="mb-4 inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
          Admin ždrijeb
        </p>

        <h1 className="text-5xl font-black text-yellow-400">
          Bracket engine
        </h1>

        <p className="mt-4 max-w-2xl text-zinc-300">
          Generira knockout, round robin ili grupe + knockout prema pravilima turnira.
        </p>
      </div>

      <section className="rounded-3xl border border-white/10 bg-zinc-950/80 p-8">
        <label className="mb-2 block text-sm font-bold text-yellow-300">
          Turnir
        </label>

        <select
          value={selectedTournament}
          onChange={(e) => setSelectedTournament(e.target.value)}
          className="input"
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — {t.location}
            </option>
          ))}
        </select>

        {tournament && (
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <Info title="Format" value={tournament.tournament_format} />
            <Info title="Status" value={tournament.status} />
            <Info title="Potvrđene ekipe" value={teams.length} />
            <Info title="Mečevi" value={matches.length} />
          </div>
        )}

        {tournament?.tournament_format === "round_robin" && (
          <p className="mt-5 rounded-2xl bg-zinc-900 p-4 text-zinc-300">
            Round robin s {teams.length} ekipa generira{" "}
            <b className="text-yellow-300">
              {calculateRoundRobinMatchCount(teams.length)}
            </b>{" "}
            mečeva.
          </p>
        )}

        <button
          onClick={generateDraw}
          className="mt-8 rounded-xl bg-yellow-400 px-8 py-4 font-black text-black transition hover:bg-yellow-300"
        >
          Generiraj prema formatu turnira
        </button>

        {message && (
          <div className="mt-6 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-yellow-300">
            {message}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-3xl font-black text-yellow-400">
          Potvrđene ekipe
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {teams.map((team) => (
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

      {Object.keys(groupedStandings).length > 0 && (
        <section className="mt-10">
          <h2 className="text-3xl font-black text-yellow-400">
            Tablice grupa
          </h2>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {Object.entries(groupedStandings).map(([groupName, rows]: any) => (
              <div
                key={groupName}
                className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
              >
                <h3 className="bg-yellow-500/10 p-4 text-xl font-bold text-yellow-300">
                  {groupName}
                </h3>

                <table className="w-full text-left text-sm">
                  <thead className="text-zinc-400">
                    <tr>
                      <th className="p-3">Ekipa</th>
                      <th>P</th>
                      <th>W</th>
                      <th>L</th>
                      <th>Bod</th>
                      <th>+/-</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row: any) => (
                      <tr key={row.id} className="border-t border-white/10">
                        <td className="p-3 font-bold text-yellow-300">
                          {row.team_name}
                        </td>
                        <td>{row.played}</td>
                        <td>{row.wins}</td>
                        <td>{row.losses}</td>
                        <td>{row.table_points}</td>
                        <td>{row.points_diff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}

      {groupMatches.length > 0 && (
        <MatchList title="Grupni mečevi" matches={groupMatches} />
      )}

      {roundRobinMatches.length > 0 && (
        <MatchList title="Round robin mečevi" matches={roundRobinMatches} />
      )}

      {knockoutMatches.length > 0 && (
        <section className="mt-10">
          <h2 className="text-3xl font-black text-yellow-400">
            Knockout bracket
          </h2>

          <div className="mt-5 flex gap-5 overflow-x-auto pb-4">
            {Object.entries(groupedKnockout).map(
              ([round, roundMatches]: any) => (
                <div key={round} className="min-w-72">
                  <h3 className="mb-4 text-xl font-bold text-yellow-300">
                    Runda {round}
                  </h3>

                  <div className="space-y-4">
                    {roundMatches.map((match: any) => (
                      <div
                        key={match.id}
                        className="rounded-2xl border border-white/10 bg-zinc-950 p-5"
                      >
                        <p className="text-sm text-zinc-500">
                          Meč {match.bracket_position || match.match_number}
                        </p>

                        <div className="mt-3 space-y-2">
                          <div className="rounded-xl bg-zinc-900 p-3 font-bold">
                            {match.team_a_name || match.team_a_seed || "Čeka"}
                          </div>
                          <div className="rounded-xl bg-zinc-900 p-3 font-bold">
                            {match.team_b_name || match.team_b_seed || "Čeka"}
                          </div>
                        </div>

                        <p className="mt-3 text-sm text-zinc-400">
                          Status: {match.status}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function Info({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-2xl bg-zinc-900 p-5">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-2 text-2xl font-black text-yellow-400">{value}</p>
    </div>
  );
}

function MatchList({ title, matches }: { title: string; matches: any[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-3xl font-black text-yellow-400">{title}</h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {matches.map((match) => (
          <div
            key={match.id}
            className="rounded-2xl border border-white/10 bg-zinc-950 p-5"
          >
            <p className="text-sm text-zinc-500">
              {match.group_name ? `${match.group_name} · ` : ""}
              Meč {match.bracket_position || match.match_number}
            </p>

            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="font-bold">{match.team_a_name}</span>
              <span className="text-yellow-400">VS</span>
              <span className="font-bold">{match.team_b_name}</span>
            </div>

            <p className="mt-3 text-sm text-zinc-400">
              Status: {match.status}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}