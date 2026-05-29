import { supabase } from "@/lib/supabase";
import { generateGroupsKnockoutSeeds } from "@/lib/bracketEngine";

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
      .map(([groupName, groupRows]: any) => [groupName, sortStandings(groupRows)]),
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

  return [...directQualifiers, ...extraQualifiers]
    .slice(0, knockoutSize)
    .sort((a, b) => (sortStandings([a, b])[0] === a ? -1 : 1))
    .map((row, index) => ({ ...row, seed: index + 1 }));
}

function bracketPairs(qualifiers: any[]) {
  const sorted = [...qualifiers].sort((a, b) => Number(a.seed) - Number(b.seed));
  const pairs: any[] = [];

  for (let i = 0; i < sorted.length / 2; i++) {
    pairs.push({
      teamA: sorted[i],
      teamB: sorted[sorted.length - 1 - i],
    });
  }

  return pairs;
}

export async function recalculateGroupStandings(tournamentId: string) {
  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId);

  if (matchesError) throw matchesError;

  const { data: standings, error: standingsError } = await supabase
    .from("group_standings")
    .select("*")
    .eq("tournament_id", tournamentId);

  if (standingsError) throw standingsError;

  const rows = calculateGroupRows(matches || [], standings || []);

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
      .eq("tournament_id", tournamentId)
      .eq("team_id", row.team_id);

    if (error) throw error;
  }

  return rows;
}

export async function unlockNextRoundAfterMatch(match: any) {
  if (!match) return false;
  if (match.phase !== "group" && match.phase !== "round_robin") return false;

  const currentRound = Number(match.round || match.round_number || 1);
  const nextRound = currentRound + 1;

  let currentRoundQuery = supabase
    .from("matches")
    .select("id,status")
    .eq("tournament_id", match.tournament_id)
    .eq("phase", match.phase)
    .eq("round", currentRound);

  if (match.phase === "group") {
    currentRoundQuery = currentRoundQuery.eq("group_name", match.group_name);
  }

  const { data: currentRoundMatches, error: currentRoundError } =
    await currentRoundQuery;

  if (currentRoundError) throw currentRoundError;

  const allCurrentRoundFinished = (currentRoundMatches || []).every(
    (roundMatch) => roundMatch.status === "finished",
  );

  if (!allCurrentRoundFinished) return false;

  let nextRoundQuery = supabase
    .from("matches")
    .update({ status: "scheduled" })
    .eq("tournament_id", match.tournament_id)
    .eq("phase", match.phase)
    .eq("round", nextRound)
    .eq("status", "waiting");

  if (match.phase === "group") {
    nextRoundQuery = nextRoundQuery.eq("group_name", match.group_name);
  }

  const { error: unlockError } = await nextRoundQuery;
  if (unlockError) throw unlockError;

  return true;
}

export async function populateKnockoutIfGroupsFinished(tournamentId: string) {
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .maybeSingle();

  if (tournamentError) throw tournamentError;
  if (!tournament || tournament.tournament_format !== "groups_knockout") {
    return false;
  }

  const { data: groupMatches, error: groupMatchesError } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("phase", "group");

  if (groupMatchesError) throw groupMatchesError;
  if (!groupMatches || groupMatches.length === 0) return false;

  const allGroupsFinished = groupMatches.every(
    (match) => match.status === "finished",
  );

  if (!allGroupsFinished) return false;

  const rows = await recalculateGroupStandings(tournamentId);
  const knockoutSize = Number(tournament.knockout_size || 16);
  const qualifiers = buildQualification(rows, knockoutSize);

  if (qualifiers.length < knockoutSize) return false;

  let { data: knockoutMatches, error: knockoutError } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("phase", "knockout");

  if (knockoutError) throw knockoutError;

  if (!knockoutMatches || knockoutMatches.length === 0) {
    const generatedKnockout = generateGroupsKnockoutSeeds(
      tournamentId,
      knockoutSize,
    );

    const { data: inserted, error: insertError } = await supabase
      .from("matches")
      .insert(generatedKnockout)
      .select("*");

    if (insertError) throw insertError;
    knockoutMatches = inserted || [];
  }

  const firstRound = (knockoutMatches || [])
    .filter((match) => Number(match.round || 1) === 1)
    .sort(
      (a, b) =>
        Number(a.bracket_position || a.match_number || 0) -
        Number(b.bracket_position || b.match_number || 0),
    );

  if (firstRound.length < knockoutSize / 2) return false;

  const { error: resetLaterRoundsError } = await supabase
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
    .eq("tournament_id", tournamentId)
    .eq("phase", "knockout")
    .gt("round", 1);

  if (resetLaterRoundsError) throw resetLaterRoundsError;

  const pairs = bracketPairs(qualifiers);

  for (let index = 0; index < pairs.length; index++) {
    const knockoutMatch = firstRound[index];
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
      .eq("id", knockoutMatch.id);

    if (error) throw error;
  }

  return true;
}

export async function syncTournamentAfterResult(match: any) {
  if (!match?.tournament_id) return;

  if (match.phase === "group") {
    await recalculateGroupStandings(match.tournament_id);
    await unlockNextRoundAfterMatch(match);
    await populateKnockoutIfGroupsFinished(match.tournament_id);
    return;
  }

  if (match.phase === "round_robin") {
    await unlockNextRoundAfterMatch(match);
  }
}
