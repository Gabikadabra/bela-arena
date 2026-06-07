"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  generateKnockoutMatches,
  generateKnockoutRepechageMatches,
  generateRoundRobinMatches,
  generateLimitedLeagueMatches,
  generateGroups,
  generateGroupsKnockoutSeeds,
  recommendFormat,
  calculateRoundRobinMatchCount,
  calculateLimitedLeagueMatchCount,
} from "@/lib/bracketEngine";

function standingScore(row: any) {
  return {
    tablePoints: Number(row.table_points || 0),
    wins: Number(row.wins || 0),
    pointsDiff: Number(row.points_diff || 0),
    pointsFor: Number(row.points_for || 0),
    teamName: String(row.team_name || ""),
  };
}

function sortStandings(rows: any[]) {
  return [...rows].sort((a, b) => {
    const aa = standingScore(a);
    const bb = standingScore(b);

    return (
      bb.tablePoints - aa.tablePoints ||
      bb.wins - aa.wins ||
      bb.pointsDiff - aa.pointsDiff ||
      bb.pointsFor - aa.pointsFor ||
      aa.teamName.localeCompare(bb.teamName, "hr")
    );
  });
}

function calculateGroupRows(matches: any[], currentStandings: any[]) {
  const stats = new Map<string, any>();

  currentStandings.forEach((row) => {
    if (!row.team_id) return;

    stats.set(row.team_id, {
      id: row.id,
      tournament_id: row.tournament_id,
      group_name: row.group_name,
      team_id: row.team_id,
      team_name: row.team_name,
      played: 0,
      wins: 0,
      losses: 0,
      points_for: 0,
      points_against: 0,
      points_diff: 0,
      table_points: 0,
    });
  });

  matches
    .filter(
      (match) =>
        match.phase === "group" &&
        match.status === "finished" &&
        match.team_a_id &&
        match.team_b_id,
    )
    .forEach((match) => {
      const scoreA = Number(match.score_a || 0);
      const scoreB = Number(match.score_b || 0);

      if (!stats.has(match.team_a_id)) {
        stats.set(match.team_a_id, {
          tournament_id: match.tournament_id,
          group_name: match.group_name,
          team_id: match.team_a_id,
          team_name: match.team_a_name,
          played: 0,
          wins: 0,
          losses: 0,
          points_for: 0,
          points_against: 0,
          points_diff: 0,
          table_points: 0,
        });
      }

      if (!stats.has(match.team_b_id)) {
        stats.set(match.team_b_id, {
          tournament_id: match.tournament_id,
          group_name: match.group_name,
          team_id: match.team_b_id,
          team_name: match.team_b_name,
          played: 0,
          wins: 0,
          losses: 0,
          points_for: 0,
          points_against: 0,
          points_diff: 0,
          table_points: 0,
        });
      }

      const teamA = stats.get(match.team_a_id);
      const teamB = stats.get(match.team_b_id);

      teamA.played += 1;
      teamA.points_for += scoreA;
      teamA.points_against += scoreB;
      teamA.points_diff = teamA.points_for - teamA.points_against;

      teamB.played += 1;
      teamB.points_for += scoreB;
      teamB.points_against += scoreA;
      teamB.points_diff = teamB.points_for - teamB.points_against;

      if (match.winner_id === match.team_a_id || scoreA > scoreB) {
        teamA.wins += 1;
        teamA.table_points += 2;
        teamB.losses += 1;
      } else if (match.winner_id === match.team_b_id || scoreB > scoreA) {
        teamB.wins += 1;
        teamB.table_points += 2;
        teamA.losses += 1;
      }
    });

  return Array.from(stats.values());
}

function calculateLeagueRows(matches: any[], teams: any[]) {
  const stats = new Map<string, any>();

  teams.forEach((team) => {
    stats.set(team.id, {
      tournament_id: team.tournament_id,
      team_id: team.id,
      team_name: team.name,
      played: 0,
      wins: 0,
      losses: 0,
      points_for: 0,
      points_against: 0,
      points_diff: 0,
      table_points: 0,
    });
  });

  matches
    .filter(
      (match) =>
        match.phase === "round_robin" &&
        match.status === "finished" &&
        match.team_a_id &&
        match.team_b_id,
    )
    .forEach((match) => {
      const teamA = stats.get(match.team_a_id);
      const teamB = stats.get(match.team_b_id);
      if (!teamA || !teamB) return;

      const scoreA = Number(match.score_a || 0);
      const scoreB = Number(match.score_b || 0);

      teamA.played += 1;
      teamA.points_for += scoreA;
      teamA.points_against += scoreB;
      teamA.points_diff = teamA.points_for - teamA.points_against;

      teamB.played += 1;
      teamB.points_for += scoreB;
      teamB.points_against += scoreA;
      teamB.points_diff = teamB.points_for - teamB.points_against;

      if (match.winner_id === match.team_a_id || scoreA > scoreB) {
        teamA.wins += 1;
        teamA.table_points += 2;
        teamB.losses += 1;
      } else if (match.winner_id === match.team_b_id || scoreB > scoreA) {
        teamB.wins += 1;
        teamB.table_points += 2;
        teamA.losses += 1;
      }
    });

  return sortStandings(Array.from(stats.values()));
}

function buildLeagueQualification(rows: any[], knockoutSize = 8) {
  const qualifiers = sortStandings(rows)
    .slice(0, knockoutSize)
    .map((row, index) => ({
      ...row,
      seed: index + 1,
      qualification_type: "league",
      qualification_label: `${index + 1}. u ligi`,
      group_rank: index + 1,
    }));

  return {
    sortedGroups: { Liga: sortStandings(rows) },
    qualifiers,
    qualifierIds: new Set(qualifiers.map((row) => row.team_id)),
    extraIds: new Set(),
  };
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
      .map(([groupName, groupRows]: any) => [
        groupName,
        sortStandings(groupRows),
      ]),
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
        qualification_label: `${index + 1}. u ${groupName}`,
        group_rank: index + 1,
      });
    });
  });

  const remaining = Math.max(0, knockoutSize - directQualifiers.length);
  const bestExtraRank = directPerGroup + 1;
  const extraCandidates = groupEntries
    .flatMap(([groupName, groupRows]) =>
      groupRows.slice(directPerGroup, bestExtraRank).map((row) => ({
        ...row,
        qualification_type: "extra",
        qualification_label: `Najbolji ${bestExtraRank}. (${groupName})`,
        group_rank: bestExtraRank,
      })),
    )
    .sort((a, b) => (sortStandings([a, b])[0] === a ? -1 : 1));

  const extraQualifiers = extraCandidates.slice(0, remaining);
  const qualifiers = [...directQualifiers, ...extraQualifiers]
    .slice(0, knockoutSize)
    .sort((a, b) => (sortStandings([a, b])[0] === a ? -1 : 1))
    .map((row, index) => ({ ...row, seed: index + 1 }));

  return {
    sortedGroups,
    qualifiers,
    qualifierIds: new Set(qualifiers.map((row) => row.team_id)),
    extraIds: new Set(extraQualifiers.map((row) => row.team_id)),
  };
}

function bracketPairs(qualifiers: any[]) {
  const sorted = [...qualifiers].sort(
    (a, b) => Number(a.seed) - Number(b.seed),
  );
  const pairs: any[] = [];

  for (let i = 0; i < sorted.length / 2; i++) {
    pairs.push({
      teamA: sorted[i],
      teamB: sorted[sorted.length - 1 - i],
    });
  }

  return pairs;
}

type DrawAnimationItem = {
  label: string;
  title: string;
  subtitle?: string;
  opponents?: string[];
};

type DrawAnimationState = {
  open: boolean;
  title: string;
  subtitle: string;
  items: DrawAnimationItem[];
  activeIndex: number;
  finished: boolean;
};

const emptyDrawAnimation: DrawAnimationState = {
  open: false,
  title: "",
  subtitle: "",
  items: [],
  activeIndex: -1,
  finished: false,
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeTeamName(name: string) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function getRegistrationTime(team: any) {
  const rawDate = team.created_at || team.registered_at || "";
  const time = new Date(rawDate).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function buildSeedPreview(teams: any[], seedCount = 8) {
  return [...teams]
    .sort((a, b) => {
      return (
        Number(b.seed_score || 1000) - Number(a.seed_score || 1000) ||
        getRegistrationTime(a) - getRegistrationTime(b) ||
        String(a.name || "").localeCompare(String(b.name || ""), "hr")
      );
    })
    .slice(0, Math.min(seedCount, teams.length))
    .map((team, index) => ({ ...team, seed_rank: index + 1 }));
}

function getRequestedTournamentId() {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  return params.get("tournamentId") || params.get("turnir") || "";
}

function replaceTournamentInUrl(tournamentId: string) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (tournamentId) url.searchParams.set("tournamentId", tournamentId);
  else url.searchParams.delete("tournamentId");
  window.history.replaceState(null, "", url.toString());
}

function getDrawAnimationItems(
  format: string,
  teams: any[],
  generated: any[] = [],
) {
  if (format === "groups_knockout") {
    const grouped: Record<string, any[]> = {};

    generated
      .filter((row: any) => row.group_name && row.team_name)
      .forEach((row: any) => {
        if (!grouped[row.group_name]) grouped[row.group_name] = [];
        grouped[row.group_name].push(row);
      });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b, "hr"))
      .flatMap(([groupName, rows]) =>
        rows.map((row, index) => ({
          label: groupName,
          title: row.team_name,
          subtitle: row.seed_rank
            ? `Nositelj #${row.seed_rank} · ${index + 1}. ekipa u grupi`
            : `${index + 1}. ekipa u grupi`,
        })),
      );
  }

  if (format === "knockout" || format === "knockout_repechage") {
    return generated
      .filter((match: any) => Number(match.round) === 1)
      .flatMap((match: any) => [
        {
          label: `Meč ${match.bracket_position || match.match_number}`,
          title: match.team_a_name || match.team_a_seed || "BYE",
          subtitle: "Pozicija A",
        },
        {
          label: `Meč ${match.bracket_position || match.match_number}`,
          title: match.team_b_name || match.team_b_seed || "BYE",
          subtitle: "Pozicija B",
        },
      ]);
  }

  if (format === "league_knockout") {
    const opponentsByTeam = new Map<string, Set<string>>();

    teams.forEach((team: any) => {
      opponentsByTeam.set(team.id, new Set<string>());
    });

    generated
      .filter(
        (match: any) =>
          match.phase === "round_robin" && match.team_a_id && match.team_b_id,
      )
      .forEach((match: any) => {
        if (!opponentsByTeam.has(match.team_a_id))
          opponentsByTeam.set(match.team_a_id, new Set<string>());
        if (!opponentsByTeam.has(match.team_b_id))
          opponentsByTeam.set(match.team_b_id, new Set<string>());

        opponentsByTeam
          .get(match.team_a_id)
          ?.add(match.team_b_name || "Nepoznata ekipa");
        opponentsByTeam
          .get(match.team_b_id)
          ?.add(match.team_a_name || "Nepoznata ekipa");
      });

    return teams.map((team: any) => {
      const opponents = Array.from(opponentsByTeam.get(team.id) || []);
      const opponentText =
        opponents.length > 0
          ? opponents.join(", ")
          : "Protivnici još nisu složeni";

      return {
        label: `${opponents.length} mečeva`,
        title: team.name,
        subtitle:
          opponents.length > 0
            ? `${opponents.length} protivnika izvučeno`
            : "Protivnici još nisu složeni",
        opponents,
      };
    });
  }

  return teams.map((team: any, index: number) => ({
    label: `Redni broj ${index + 1}`,
    title: team.name,
    subtitle: team.city || "Round robin raspored",
  }));
}

export default function ZdrijebAdminPage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [drawAnimation, setDrawAnimation] =
    useState<DrawAnimationState>(emptyDrawAnimation);

  useEffect(() => {
    loadTournaments();

    const channel = supabase
      .channel("zdrijeb-tournaments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => loadTournaments(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!selectedTournament) return;

    loadTournamentData();

    const channel = supabase
      .channel(`zdrijeb-${selectedTournament}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournaments",
          filter: `id=eq.${selectedTournament}`,
        },
        () => loadTournamentData(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `tournament_id=eq.${selectedTournament}`,
        },
        () => loadTournamentData(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${selectedTournament}`,
        },
        () => loadTournamentData(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_standings",
          filter: `tournament_id=eq.${selectedTournament}`,
        },
        () => loadTournamentData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_games" },
        () => loadTournamentData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_sets" },
        () => loadTournamentData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTournament]);

  async function loadTournaments() {
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .order("starts_at", { ascending: true });

    const activeTournaments = (data || []).filter(
      (row: any) => row.status !== "finished",
    );
    const requestedTournamentId = getRequestedTournamentId();

    setTournaments(activeTournaments);

    if (activeTournaments.length > 0) {
      setSelectedTournament((current) => {
        if (
          requestedTournamentId &&
          activeTournaments.some((t) => t.id === requestedTournamentId)
        ) {
          return requestedTournamentId;
        }

        return current && activeTournaments.some((t) => t.id === current)
          ? current
          : activeTournaments[0].id;
      });
    } else {
      setSelectedTournament("");
      setTournament(null);
      setTeams([]);
      setMatches([]);
      setStandings([]);
    }
  }

  function handleTournamentChange(tournamentId: string) {
    setSelectedTournament(tournamentId);
    replaceTournamentInUrl(tournamentId);
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

    const { data: rankingData } = await supabase
      .from("team_ranking_stats")
      .select("team_id, team_name, elo, wins, total_matches");

    const rankingById = new Map(
      (rankingData || []).map((row: any) => [row.team_id, row]),
    );
    const rankingByName = new Map(
      (rankingData || []).map((row: any) => [
        normalizeTeamName(row.team_name),
        row,
      ]),
    );

    const teamsWithSeeds = (teamData || []).map((team: any) => {
      const ranking =
        rankingById.get(team.id) ||
        rankingByName.get(normalizeTeamName(team.name));
      return {
        ...team,
        seed_score: Number((ranking as any)?.elo || 1000),
        seed_wins: Number((ranking as any)?.wins || 0),
        seed_matches: Number((ranking as any)?.total_matches || 0),
        registered_at: team.created_at,
      };
    });

    setTeams(teamsWithSeeds);

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
      .order("group_name", { ascending: true });

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

  async function deleteDraw() {
    if (!selectedTournament) return;

    const confirmed = window.confirm(
      "Jesi siguran da želiš izbrisati ždrijeb? Brišu se mečevi, rezultati, setovi, partije i tablice grupa. Ekipe ostaju prijavljene, a turnir se vraća na open.",
    );

    if (!confirmed) return;

    setWorking(true);
    setMessage("");

    try {
      await clearOldDraw();

      const { error } = await supabase
        .from("tournaments")
        .update({ status: "open" })
        .eq("id", selectedTournament);

      if (error) throw error;

      setMessage(
        "Ždrijeb je izbrisan, a turnir je vraćen na otvorene prijave.",
      );
      await loadTournamentData();
    } catch (error: any) {
      setMessage("Greška kod brisanja ždrijeba: " + error.message);
    } finally {
      setWorking(false);
    }
  }

  async function playDrawAnimation(
    title: string,
    subtitle: string,
    items: DrawAnimationItem[],
  ) {
    const limitedItems = items.filter(
      (item) => item.title && item.title !== "BYE",
    );

    if (limitedItems.length === 0) return;

    setDrawAnimation({
      open: true,
      title,
      subtitle,
      items: limitedItems,
      activeIndex: -1,
      finished: false,
    });

    await sleep(900);

    for (let i = 0; i < limitedItems.length; i++) {
      setDrawAnimation((current) => ({ ...current, activeIndex: i }));
      await sleep(2300);
    }

    setDrawAnimation((current) => ({ ...current, finished: true }));
    await sleep(1400);
    setDrawAnimation(emptyDrawAnimation);
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
      setWorking(true);

      if (tournament.tournament_format === "knockout") {
        const generated = generateKnockoutMatches(selectedTournament, teams);
        await playDrawAnimation(
          "LIVE ŽDRIJEB",
          "Izvlače se parovi knockout bracket-a",
          getDrawAnimationItems("knockout", teams, generated),
        );
        await clearOldDraw();

        const { data: insertedMatches, error } = await supabase
          .from("matches")
          .insert(generated)
          .select("*");

        if (error) throw error;

        const byeWinners = insertedMatches.filter(
          (m) =>
            m.round === 1 &&
            ((m.team_a_id && !m.team_b_id) || (!m.team_a_id && m.team_b_id)),
        );

        for (const match of byeWinners) {
          const winnerId = match.team_a_id || match.team_b_id;
          const winnerName = match.team_a_name || match.team_b_name;

          const nextMatch = insertedMatches.find(
            (m) =>
              m.phase === "knockout" &&
              m.round === 2 &&
              m.bracket_position === Math.ceil(match.bracket_position / 2),
          );

          if (!nextMatch) continue;

          const nextSlot = match.bracket_position % 2 === 1 ? "A" : "B";

          if (nextSlot === "A") {
            await supabase
              .from("matches")
              .update({
                team_a_id: winnerId,
                team_a_name: winnerName,
                status: nextMatch.team_b_id ? "scheduled" : "waiting",
              })
              .eq("id", nextMatch.id);
          } else {
            await supabase
              .from("matches")
              .update({
                team_b_id: winnerId,
                team_b_name: winnerName,
                status: nextMatch.team_a_id ? "scheduled" : "waiting",
              })
              .eq("id", nextMatch.id);
          }

          await supabase
            .from("matches")
            .update({
              winner_id: winnerId,
              status: "finished",
            })
            .eq("id", match.id);
        }

        setMessage("Knockout bracket je generiran.");
      } else if (tournament.tournament_format === "knockout_repechage") {
        const generated = generateKnockoutRepechageMatches(selectedTournament, teams);
        await playDrawAnimation(
          "LIVE ŽDRIJEB S REPESAŽOM",
          "Izvlači se glavni ždrijeb. Gubitnici prvog poraza dobivaju drugu šansu u repesažu.",
          getDrawAnimationItems("knockout_repechage", teams, generated),
        );
        await clearOldDraw();

        const { data: insertedMatches, error } = await supabase
          .from("matches")
          .insert(generated)
          .select("*");

        if (error) throw error;

        const byeMatches = (insertedMatches || []).filter(
          (m: any) =>
            m.bracket_type === "winners" &&
            Number(m.round || 1) === 1 &&
            m.status === "bye" &&
            m.winner_id,
        );

        for (const byeMatch of byeMatches) {
          const winnerId = byeMatch.winner_id;
          const winnerName =
            winnerId === byeMatch.team_a_id ? byeMatch.team_a_name : byeMatch.team_b_name;

          if (!byeMatch.next_match_id || !byeMatch.next_match_slot) continue;

          const { data: nextMatch } = await supabase
            .from("matches")
            .select("*")
            .eq("id", byeMatch.next_match_id)
            .maybeSingle();

          if (!nextMatch) continue;

          const updatePayload: any =
            byeMatch.next_match_slot === "A"
              ? { team_a_id: winnerId, team_a_name: winnerName }
              : { team_b_id: winnerId, team_b_name: winnerName };

          const otherReady =
            byeMatch.next_match_slot === "A"
              ? Boolean(nextMatch.team_b_id)
              : Boolean(nextMatch.team_a_id);

          updatePayload.status = otherReady ? "scheduled" : "waiting";

          await supabase.from("matches").update(updatePayload).eq("id", nextMatch.id);
          await supabase.from("matches").update({ status: "finished" }).eq("id", byeMatch.id);
        }

        setMessage("Knockout s repesažom je generiran. Ekipa ispada tek nakon drugog poraza.");
      } else if (tournament.tournament_format === "round_robin") {
        const generated = generateRoundRobinMatches(
          selectedTournament,
          teams,
          Number(tournament.league_rounds || 1),
        );
        await playDrawAnimation(
          "LIVE ŽDRIJEB",
          "Ekipe se predstavljaju prije izrade Berger rasporeda",
          getDrawAnimationItems("round_robin", teams, generated),
        );
        await clearOldDraw();

        const { error } = await supabase.from("matches").insert(generated);
        if (error) throw error;

        setMessage("Round robin raspored je generiran.");
      } else if (tournament.tournament_format === "league_knockout") {
        const knockoutSize = Number(tournament.knockout_size || 8);
        const leagueMatchCount = Number(tournament.league_match_count || 8);
        const generatedLeague = generateLimitedLeagueMatches(
          selectedTournament,
          teams,
          leagueMatchCount,
        );
        const generatedKnockout = generateGroupsKnockoutSeeds(
          selectedTournament,
          knockoutSize,
        );

        await playDrawAnimation(
          "LIVE ŽDRIJEB LIGE PRVAKA",
          `Prvo se slaže liga faza (${Number(tournament.league_match_count || 8)} mečeva po ekipi), a knockout čeka najbolje ekipe`,
          getDrawAnimationItems("league_knockout", teams, generatedLeague),
        );
        await clearOldDraw();

        const { error: matchesError } = await supabase
          .from("matches")
          .insert([...generatedLeague, ...generatedKnockout]);

        if (matchesError) throw matchesError;

        setMessage(
          "Liga prvaka format je generiran. Nakon lige klikni 'Ažuriraj tablice i popuni knockout'.",
        );
      } else if (tournament.tournament_format === "groups_knockout") {
        const groupSize = tournament.group_size || 4;
        const knockoutSize = tournament.knockout_size || 16;

        const generatedGroups = generateGroups(
          selectedTournament,
          teams,
          groupSize,
        );

        const generatedKnockout = generateGroupsKnockoutSeeds(
          selectedTournament,
          knockoutSize,
        );

        await playDrawAnimation(
          "LIVE ŽDRIJEB GRUPA",
          "Ekipe se polako prikazuju i odlaze u svoju grupu",
          getDrawAnimationItems(
            "groups_knockout",
            teams,
            generatedGroups.standings,
          ),
        );
        await clearOldDraw();

        const { error: standingsError } = await supabase
          .from("group_standings")
          .insert(generatedGroups.standings);

        if (standingsError) throw standingsError;

        const { error: matchesError } = await supabase
          .from("matches")
          .insert([...generatedGroups.matches, ...generatedKnockout]);

        if (matchesError) throw matchesError;

        setMessage(
          "Grupe + knockout su generirani. Nakon završetka grupa klikni 'Ažuriraj tablice i popuni knockout'.",
        );
      }

      await supabase
        .from("tournaments")
        .update({ status: "live" })
        .eq("id", selectedTournament);

      await loadTournamentData();
    } catch (error: any) {
      setMessage("Greška: " + error.message);
    } finally {
      setWorking(false);
    }
  }

  async function updateGroupStandingsOnly(
    rows = calculateGroupRows(matches, standings),
  ) {
    for (const row of rows) {
      const { error } = await supabase
        .from("group_standings")
        .update({
          played: row.played,
          wins: row.wins,
          losses: row.losses,
          points_for: row.points_for,
          points_against: row.points_against,
          points_diff: row.points_diff,
          table_points: row.table_points,
        })
        .eq("tournament_id", selectedTournament)
        .eq("team_id", row.team_id);

      if (error) throw error;
    }
  }

  async function updateTablesAndAdvance() {
    setMessage("");

    if (
      !tournament ||
      !["groups_knockout", "league_knockout"].includes(
        tournament.tournament_format,
      )
    ) {
      setMessage(
        "Ova opcija je samo za format koji nakon prve faze ima knockout.",
      );
      return;
    }

    try {
      setWorking(true);

      const knockoutSize = Number(tournament.knockout_size || 16);
      const recalculatedRows =
        tournament.tournament_format === "league_knockout"
          ? calculateLeagueRows(matches, teams)
          : calculateGroupRows(matches, standings);

      if (tournament.tournament_format === "groups_knockout") {
        await updateGroupStandingsOnly(recalculatedRows);
      }

      const qualification =
        tournament.tournament_format === "league_knockout"
          ? buildLeagueQualification(recalculatedRows, knockoutSize)
          : buildQualification(recalculatedRows, knockoutSize);
      const qualifiers = qualification.qualifiers;

      if (qualifiers.length < knockoutSize) {
        throw new Error(
          `Nema dovoljno ekipa za knockout. Imam ${qualifiers.length}, treba ${knockoutSize}.`,
        );
      }

      const firstPhase =
        tournament.tournament_format === "league_knockout"
          ? "round_robin"
          : "group";
      const unfinishedGroupMatches = matches.filter(
        (match) => match.phase === firstPhase && match.status !== "finished",
      );

      let currentKnockoutMatches = matches.filter(
        (match) => match.phase === "knockout",
      );

      if (currentKnockoutMatches.length === 0) {
        const generatedKnockout = generateGroupsKnockoutSeeds(
          selectedTournament,
          knockoutSize,
        );

        const { data: inserted, error } = await supabase
          .from("matches")
          .insert(generatedKnockout)
          .select("*");

        if (error) throw error;
        currentKnockoutMatches = inserted || [];
      }

      const firstRound = currentKnockoutMatches
        .filter((match) => Number(match.round || 1) === 1)
        .sort(
          (a, b) =>
            Number(a.bracket_position || a.match_number || 0) -
            Number(b.bracket_position || b.match_number || 0),
        );

      if (firstRound.length < knockoutSize / 2) {
        throw new Error(
          "Knockout bracket nema dovoljno mjesta. Generiraj ždrijeb ponovno ili provjeri knockout_size.",
        );
      }

      await supabase
        .from("matches")
        .update({
          team_a_id: null,
          team_b_id: null,
          team_a_name: "Pobjednik čeka",
          team_b_name: "Pobjednik čeka",
          winner_id: null,
          score_a: 0,
          score_b: 0,
          sets_a: 0,
          sets_b: 0,
          current_set: 1,
          status: "waiting",
          result_status: "draft",
        })
        .eq("tournament_id", selectedTournament)
        .eq("phase", "knockout")
        .gt("round", 1);

      const pairs = bracketPairs(qualifiers);

      for (let index = 0; index < pairs.length; index++) {
        const match = firstRound[index];
        const pair = pairs[index];

        const { error } = await supabase
          .from("matches")
          .update({
            team_a_id: pair.teamA.team_id,
            team_a_name: pair.teamA.team_name,
            team_b_id: pair.teamB.team_id,
            team_b_name: pair.teamB.team_name,
            team_a_seed: `#${pair.teamA.seed} ${pair.teamA.qualification_label}`,
            team_b_seed: `#${pair.teamB.seed} ${pair.teamB.qualification_label}`,
            winner_id: null,
            score_a: 0,
            score_b: 0,
            sets_a: 0,
            sets_b: 0,
            current_set: 1,
            status: "scheduled",
            result_status: "draft",
          })
          .eq("id", match.id);

        if (error) throw error;
      }

      await supabase
        .from("tournaments")
        .update({ status: "live" })
        .eq("id", selectedTournament);

      await loadTournamentData();

      setMessage(
        unfinishedGroupMatches.length > 0
          ? `Tablice su ažurirane i knockout je popunjen, ali još ima ${unfinishedGroupMatches.length} nezavršenih grupnih mečeva.`
          : "Tablice su ažurirane, poredak je sortiran i knockout je automatski popunjen.",
      );
    } catch (error: any) {
      setMessage("Greška: " + error.message);
    } finally {
      setWorking(false);
    }
  }

  const recommended = recommendFormat(teams.length);
  const standingsForView = useMemo(
    () => calculateGroupRows(matches, standings),
    [matches, standings],
  );
  const leagueRowsForView = useMemo(
    () => calculateLeagueRows(matches, teams),
    [matches, teams],
  );
  const knockoutSize = Number(tournament?.knockout_size || 16);
  const qualification = useMemo(
    () =>
      tournament?.tournament_format === "league_knockout"
        ? buildLeagueQualification(leagueRowsForView, knockoutSize)
        : buildQualification(standingsForView, knockoutSize),
    [
      standingsForView,
      leagueRowsForView,
      knockoutSize,
      tournament?.tournament_format,
    ],
  );
  const seededTeams = useMemo(() => buildSeedPreview(teams, 8), [teams]);

  const groupMatches = matches.filter((m) => m.phase === "group");
  const knockoutMatches = matches.filter((m) => m.phase === "knockout");
  const roundRobinMatches = matches.filter((m) => m.phase === "round_robin");

  const groupedKnockout = knockoutMatches.reduce((acc: any, match: any) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

  return (
    <main className="page">
      {drawAnimation.open && <FancyDrawOverlay animation={drawAnimation} />}

      <section className="hero-card mb-10">
        <span className="badge">Admin ždrijeb</span>

        <h1 className="page-title mt-4">Bracket engine</h1>

        <p className="muted mt-4 max-w-2xl">
          Generira knockout, repesaž, round robin ili grupe + knockout. Grupni i round
          robin mečevi slažu se Berger sustavom po rundama. Sljedeća runda se
          otključava tek kad prethodna završi.
        </p>
      </section>

      <section className="card">
        <label className="mb-2 block text-sm font-bold text-[#d4b06a]">
          Turnir
        </label>

        <select
          value={selectedTournament}
          onChange={(e) => handleTournamentChange(e.target.value)}
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
          <p className="mt-5 card-soft muted">
            Round robin s {teams.length} ekipa generira{" "}
            <b className="text-[#d4b06a]">
              {calculateRoundRobinMatchCount(
                teams.length,
                Number(tournament?.league_rounds || 1),
              )}
            </b>{" "}
            mečeva.
          </p>
        )}

        {tournament?.tournament_format === "league_knockout" && (
          <p className="mt-5 card-soft muted">
            Liga prvaka faza: svaka ekipa igra do{" "}
            <b className="text-[#d4b06a]">
              {Number(tournament?.league_match_count || 8)}
            </b>{" "}
            mečeva, ukupno oko{" "}
            <b className="text-[#d4b06a]">
              {calculateLimitedLeagueMatchCount(
                teams.length,
                Number(tournament?.league_match_count || 8),
              )}
            </b>{" "}
            ligaških mečeva prije knockout-a.
          </p>
        )}

        {["groups_knockout", "league_knockout"].includes(
          tournament?.tournament_format,
        ) && (
          <div className="mt-5 card-soft">
            <p className="font-bold text-[#f3dfad]">Pravila prolaska</p>
            <p className="muted mt-2">
              {tournament?.tournament_format === "league_knockout" ? (
                <>
                  Knockout prima{" "}
                  <b className="text-[#d4b06a]">{knockoutSize}</b> ekipa. Liga
                  faza se generira ograničenim Berger rasporedom: svaka ekipa
                  igra do{" "}
                  <b className="text-[#d4b06a]">
                    {Number(tournament?.league_match_count || 8)}
                  </b>{" "}
                  mečeva, ne svatko protiv svakog. Prvo je otključana samo 1.
                  runda, a iduća se otključava tek kad se prethodna runda
                  završi. Nakon liga faze sustav sortira jednu zajedničku
                  tablicu i u knockout šalje najboljih{" "}
                  <b className="text-[#d4b06a]">{knockoutSize}</b> ekipa.
                </>
              ) : (
                <>
                  Knockout prima{" "}
                  <b className="text-[#d4b06a]">{knockoutSize}</b> ekipa. Grupni
                  mečevi se generiraju Berger sustavom, po rundama. Prvo je
                  otključana samo 1. runda, a iduća se otključava tek kad se svi
                  mečevi prethodne runde u toj grupi završe. Sustav zatim uzima
                  direktne prolaznike iz svake grupe, a preostala mjesta
                  popunjava samo najboljim ekipama iz idućeg ranga. Primjer: ako
                  prolazi 16 ekipa iz 6 grupa, prolaze prvi i drugi iz svake
                  grupe te samo 4 najbolja treća — četvrti ne može proći dalje.
                </>
              )}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={generateDraw}
            disabled={working}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {working ? "Radim..." : "Generiraj prema formatu turnira"}
          </button>

          <button
            onClick={deleteDraw}
            disabled={working || matches.length === 0}
            className="btn-danger disabled:cursor-not-allowed disabled:opacity-60"
          >
            Izbriši ždrijeb
          </button>

          {["groups_knockout", "league_knockout"].includes(
            tournament?.tournament_format,
          ) && (
            <button
              onClick={updateTablesAndAdvance}
              disabled={
                working ||
                (tournament?.tournament_format === "groups_knockout"
                  ? standings.length === 0
                  : roundRobinMatches.length === 0)
              }
              className="btn-outline disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ažuriraj tablice i popuni knockout
            </button>
          )}
        </div>

        {message && (
          <div className="mt-6 rounded-2xl border border-[#d4b06a]/30 bg-[#d4b06a]/10 p-5 font-bold text-[#d4b06a]">
            {message}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Potvrđene ekipe</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {teams.map((team) => (
            <div key={team.id} className="card-soft">
              <h3 className="font-bold text-[#d4b06a]">{team.name}</h3>
              <p className="text-sm text-white/60">
                {team.city || "Grad nije upisan"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 card">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h2 className="section-title">Nositelji ždrijeba</h2>
            <p className="muted mt-2">
              Prikazuje se samo top 8 nositelja. Prvo se gleda ELO, a ako ekipe
              imaju isti ELO prednost ima ekipa koja se ranije prijavila. Kod
              grupa se tih 8 najjačih raspoređuje zmijskim redom po grupama, da
              najjače ekipe ne završe sve zajedno.
            </p>
          </div>
          <span className="badge">Top {seededTeams.length}/8</span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {seededTeams.map((team) => (
            <div
              key={team.id}
              className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018]/70 p-4"
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d4b06a]/70">
                Nositelj #{team.seed_rank}
              </p>
              <h3 className="mt-2 font-black text-[#f3dfad]">{team.name}</h3>
              <p className="mt-1 text-sm text-white/60">
                {team.city || "Grad nije upisan"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-white/55">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                  {Math.round(Number(team.seed_score || 1000))} ELO
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                  {team.seed_wins || 0} pobjeda
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                  Prijava #
                  {team.created_at
                    ? new Date(team.created_at).toLocaleDateString("hr-HR")
                    : "-"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {Object.keys(qualification.sortedGroups).length > 0 && (
        <section className="mt-10">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="section-title">Tablice grupa</h2>
              <p className="muted mt-2">
                Tablice su sortirane automatski. Zlatna oznaka znači da ekipa
                trenutno prolazi u knockout.
              </p>
            </div>

            <span className="badge">
              {qualification.qualifiers.length}/{knockoutSize} prolazi
            </span>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {Object.entries(qualification.sortedGroups).map(
              ([groupName, rows]: any) => (
                <GroupTable
                  key={groupName}
                  groupName={groupName}
                  rows={rows}
                  qualifierIds={qualification.qualifierIds}
                  extraIds={qualification.extraIds}
                />
              ),
            )}
          </div>
        </section>
      )}

      {qualification.qualifiers.length > 0 &&
        ["groups_knockout", "league_knockout"].includes(
          tournament?.tournament_format,
        ) && (
          <section className="mt-10 card">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <h2 className="section-title">Ekipe koje prolaze dalje</h2>
                <p className="muted mt-2">
                  Ovim redom se pune nositelji za knockout.
                </p>
              </div>
              <span className="badge">Seed lista</span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {qualification.qualifiers.map((row) => (
                <div
                  key={row.team_id}
                  className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018]/70 p-4"
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d4b06a]/70">
                    Seed #{row.seed}
                  </p>
                  <h3 className="mt-2 font-black text-[#f3dfad]">
                    {row.team_name}
                  </h3>
                  <p className="mt-1 text-sm text-white/60">
                    {row.qualification_label}
                  </p>
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
          <h2 className="section-title">Knockout bracket</h2>

          <div className="mt-5 flex gap-5 overflow-x-auto pb-4">
            {Object.entries(groupedKnockout).map(
              ([round, roundMatches]: any) => (
                <div key={round} className="min-w-72">
                  <h3 className="mb-4 text-xl font-bold text-[#d4b06a]">
                    Runda {round}
                  </h3>

                  <div className="space-y-4">
                    {roundMatches
                      .sort(
                        (a: any, b: any) =>
                          Number(a.bracket_position || 0) -
                          Number(b.bracket_position || 0),
                      )
                      .map((match: any) => (
                        <MatchBox key={match.id} match={match} />
                      ))}
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function FancyDrawOverlay({ animation }: { animation: DrawAnimationState }) {
  const activeItem = animation.items[animation.activeIndex];
  const revealedItems = animation.items.slice(
    0,
    Math.max(animation.activeIndex + 1, 0),
  );
  const progress = animation.items.length
    ? Math.round(((animation.activeIndex + 1) / animation.items.length) * 100)
    : 0;

  const groupLabels = Array.from(
    new Set(animation.items.map((item) => item.label)),
  );
  const showGroupTables =
    groupLabels.length > 1 &&
    groupLabels.every((label) => label.toLowerCase().includes("grupa"));

  const tableLabels = showGroupTables ? groupLabels : groupLabels.slice(0, 8);
  const isLeagueSchedule = animation.title
    .toLowerCase()
    .includes("lige prvaka");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#020806]/95 px-3 py-5 backdrop-blur-xl">
      <div className="draw-lights" />
      <div className="draw-confetti" />

      <div className="relative w-full max-w-7xl rounded-[2rem] border border-[#d4b06a]/35 bg-gradient-to-b from-[#12392b]/95 to-[#061710]/95 p-4 shadow-[0_0_90px_rgba(212,176,106,0.18)] sm:p-7">
        <div className="text-center">
          <span className="badge">Bela Arena live draw</span>
          <h2 className="mt-3 text-2xl font-black text-[#f3dfad] sm:text-5xl">
            {animation.title}
          </h2>
          <p className="mx-auto mt-2 max-w-3xl text-sm font-semibold text-white/65 sm:text-base">
            {animation.subtitle}
          </p>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#d4b06a] to-[#f3dfad] transition-all duration-700"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.45fr] lg:items-stretch">
          <div className="relative overflow-hidden rounded-[1.8rem] border border-[#d4b06a]/20 bg-black/25 p-5 text-center">
            <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-[#d4b06a]/10 blur-3xl" />

            <p className="relative text-xs font-black uppercase tracking-[0.28em] text-[#d4b06a]/75">
              Trenutno se izvlači
            </p>

            <div className="relative mt-6 flex min-h-[245px] items-center justify-center">
              {activeItem ? (
                <div
                  key={`${animation.activeIndex}-${activeItem.title}`}
                  className="draw-team-card w-full"
                >
                  {isLeagueSchedule ? (
                    <div className="grid gap-4 text-left lg:grid-cols-[0.85fr_1.15fr]">
                      <div className="rounded-3xl bg-[#071810]/10 p-4 text-center lg:text-left">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#071810]/60">
                          Ekipa
                        </p>
                        <h3 className="mt-3 text-3xl font-black leading-tight text-[#071810] sm:text-5xl">
                          {activeItem.title}
                        </h3>
                        <div className="mt-5 inline-flex rounded-full bg-[#071810] px-4 py-2 text-sm font-black text-[#f3dfad]">
                          Liga faza · {activeItem.label}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-[#071810]/15 bg-white/30 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#071810]/60">
                          Protiv koga igra
                        </p>
                        <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                          {(activeItem.opponents || []).length > 0 ? (
                            activeItem.opponents?.map((opponent, index) => (
                              <div
                                key={`${activeItem.title}-${opponent}-${index}`}
                                className="rounded-2xl border border-[#071810]/15 bg-[#071810]/10 px-3 py-2 text-sm font-black text-[#071810]"
                              >
                                {index + 1}. {opponent}
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-[#071810]/20 px-3 py-3 text-center text-sm font-black text-[#071810]/55">
                              Čekaju se protivnici
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#071810]/60">
                        Ekipa
                      </p>
                      <h3 className="mt-3 text-3xl font-black text-[#071810] sm:text-5xl">
                        {activeItem.title}
                      </h3>
                      <div className="mt-5 inline-flex rounded-full bg-[#071810] px-4 py-2 text-sm font-black text-[#f3dfad]">
                        Ide u {activeItem.label}
                      </div>
                      {activeItem.subtitle && (
                        <p className="mt-3 text-sm font-bold text-[#071810]/65">
                          {activeItem.subtitle}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="draw-waiting-card">
                  <p className="text-lg font-black text-[#f3dfad]">
                    Priprema izvlačenja...
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white/45">
                    Sve tablice čekaju ekipe.
                  </p>
                </div>
              )}
            </div>

            <div className="relative mt-4 rounded-3xl border border-[#d4b06a]/20 bg-[#061710]/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-white/45">
                  Napredak
                </span>
                <span className="rounded-full border border-[#d4b06a]/25 bg-[#d4b06a]/10 px-3 py-1 text-xs font-black text-[#d4b06a]">
                  {Math.max(animation.activeIndex + 1, 0)}/
                  {animation.items.length}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold text-white/55">
                {animation.finished
                  ? "Ždrijeb završen — spremam raspored"
                  : activeItem
                    ? isLeagueSchedule
                      ? `${activeItem.title} dobiva svoje protivnike`
                      : `${activeItem.title} se upisuje u ${activeItem.label}`
                    : "Za trenutak kreće prvo ime."}
              </p>
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-[#d4b06a]/15 bg-[#071810]/70 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-black text-[#f3dfad]">
                {isLeagueSchedule
                  ? "Ekipa → protivnici"
                  : showGroupTables
                    ? "Tablice grupa"
                    : "Izvučeno"}
              </p>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
                sporo izvlačenje
              </span>
            </div>

            {showGroupTables ? (
              <div className="grid max-h-[470px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {tableLabels.map((label) => {
                  const rows = revealedItems.filter(
                    (item) => item.label === label,
                  );
                  const isActiveGroup = activeItem?.label === label;

                  return (
                    <div
                      key={label}
                      className={`min-h-[190px] rounded-3xl border p-3 transition-all duration-500 ${
                        isActiveGroup
                          ? "border-[#d4b06a]/70 bg-[#d4b06a]/15 shadow-[0_0_30px_rgba(212,176,106,0.16)]"
                          : "border-white/10 bg-white/[0.035]"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="font-black text-[#f3dfad]">{label}</h3>
                        <span className="rounded-full bg-black/25 px-2 py-1 text-[0.65rem] font-black text-white/45">
                          {rows.length} ekipa
                        </span>
                      </div>

                      <div className="space-y-2">
                        {rows.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/10 p-3 text-center text-xs font-bold text-white/35">
                            Čeka prvo ime
                          </div>
                        ) : (
                          rows.map((item, index) => (
                            <div
                              key={`${item.label}-${item.title}-${index}`}
                              className={`draw-table-row rounded-2xl border px-3 py-2 ${
                                item === activeItem
                                  ? "border-[#f3dfad]/70 bg-[#f3dfad]/15"
                                  : "border-white/10 bg-black/20"
                              }`}
                            >
                              <p className="text-sm font-black text-[#f3dfad]">
                                {item.title}
                              </p>
                              <p className="text-[0.68rem] font-semibold text-white/40">
                                {item.subtitle}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid max-h-[470px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {revealedItems.map((item, index) => (
                  <div
                    key={`${item.label}-${item.title}-${index}`}
                    className={`rounded-2xl border p-3 transition-all duration-300 ${
                      index === animation.activeIndex
                        ? "border-[#d4b06a]/60 bg-[#d4b06a]/15 shadow-[0_0_28px_rgba(212,176,106,0.18)]"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#d4b06a]/70">
                      {isLeagueSchedule ? "Ekipa" : item.label}
                    </p>
                    <p className="mt-1 font-black text-[#f3dfad]">
                      {item.title}
                    </p>
                    {isLeagueSchedule ? (
                      <div className="mt-2 space-y-1">
                        {(item.opponents || [])
                          .slice(0, 8)
                          .map((opponent, opponentIndex) => (
                            <div
                              key={`${item.title}-${opponent}-${opponentIndex}`}
                              className="rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-xs font-bold text-white/70"
                            >
                              {opponentIndex + 1}. {opponent}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-xs text-white/45">{item.subtitle}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 text-center text-xs font-bold uppercase tracking-[0.25em] text-white/45">
          {animation.finished
            ? "Ždrijeb završen — spremam raspored"
            : "Bela Arena · Champions League style"}
        </div>
      </div>
    </div>
  );
}

function Info({ title, value }: { title: string; value: any }) {
  return (
    <div className="stat-card">
      <p className="text-sm text-white/60">{title}</p>
      <p className="mt-2 text-2xl font-black text-[#f3dfad]">{value}</p>
    </div>
  );
}

function GroupTable({
  groupName,
  rows,
  qualifierIds,
  extraIds,
}: {
  groupName: string;
  rows: any[];
  qualifierIds: Set<string>;
  extraIds: Set<string>;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#d4b06a]/15 bg-[#0a2018]/90 shadow-2xl">
      <h3 className="bg-[#d4b06a]/10 p-4 text-xl font-black text-[#d4b06a]">
        {groupName}
      </h3>

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
                <tr
                  key={row.id || row.team_id}
                  className={`border-t border-[#d4b06a]/10 ${
                    qualified ? "bg-[#d4b06a]/10" : ""
                  }`}
                >
                  <td className="p-3 font-black text-white/60">{index + 1}</td>
                  <td className="p-3 font-black text-[#f3dfad]">
                    {row.team_name}
                  </td>
                  <td className="p-3">{row.played}</td>
                  <td className="p-3">{row.wins}</td>
                  <td className="p-3">{row.losses}</td>
                  <td className="p-3 font-black text-[#d4b06a]">
                    {row.table_points}
                  </td>
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

function MatchList({ title, matches }: { title: string; matches: any[] }) {
  return (
    <section className="mt-10">
      <h2 className="section-title">{title}</h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {matches.map((match) => (
          <MatchBox key={match.id} match={match} />
        ))}
      </div>
    </section>
  );
}

function MatchBox({ match }: { match: any }) {
  const winnerA = match.winner_id && match.winner_id === match.team_a_id;
  const winnerB = match.winner_id && match.winner_id === match.team_b_id;
  const locked = match.status === "waiting" || match.status === "bye";
  const finished = match.status === "finished";
  const live =
    match.status === "scheduled" ||
    match.status === "active" ||
    match.status === "live";
  const statusLabel = finished
    ? "Završeno"
    : locked
      ? "Zaključano"
      : live
        ? "LIVE"
        : match.status;
  const statusClass = finished
    ? "border-green-500/30 bg-green-500/15 text-green-300"
    : locked
      ? "border-zinc-500/25 bg-zinc-500/10 text-zinc-300"
      : live
        ? "border-red-500/30 bg-red-500/15 text-red-300"
        : "border-[#d4b06a]/20 bg-[#d4b06a]/10 text-[#d4b06a]";

  return (
    <div className="card-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-white/45">
          {match.group_name ? `${match.group_name} · ` : ""}
          {match.phase === "group" || match.phase === "round_robin"
            ? `Runda ${match.round} · `
            : ""}
          Meč {match.bracket_position || match.match_number}
        </p>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass}`}
        >
          {statusLabel}
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

      {locked ? (
        <button
          disabled
          className="btn-outline mt-4 w-full cursor-not-allowed opacity-50"
        >
          Čeka prethodnu rundu
        </button>
      ) : (
        <a href={`/live/${match.id}`} className="btn-outline mt-4 w-full">
          Live prikaz
        </a>
      )}
    </div>
  );
}

function TeamLine({
  name,
  score,
  winner,
}: {
  name: string;
  score: number;
  winner?: boolean;
}) {
  return (
    <div
      className={`mb-2 flex items-center justify-between rounded-2xl p-3 ${winner ? "bg-green-500/15 text-green-200" : "bg-[#0a2018]/70 text-zinc-200"}`}
    >
      <span className="font-black">{name}</span>
      <span className="text-xl font-black text-[#f3dfad]">{score || 0}</span>
    </div>
  );
}
