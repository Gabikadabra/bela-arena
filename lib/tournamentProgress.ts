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



async function getTournamentRepechageFee(tournamentId: string | null | undefined) {
  if (!tournamentId) return 10;

  const { data, error } = await supabase
    .from("tournaments")
    .select("tournament_format,repechage_fee_amount")
    .eq("id", tournamentId)
    .maybeSingle();

  if (error) throw error;

  if (data?.tournament_format !== "knockout_repechage") return 0;
  return Math.max(0, Number(data?.repechage_fee_amount ?? 10));
}

async function shouldPauseLoserForRepechageFee(match: any) {
  if (!match?.loser_next_match_id || !match?.loser_next_match_slot) return false;
  if (match.bracket_type !== "winners") return false;
  if (match.repechage_fee_paid) return false;

  const feeAmount = await getTournamentRepechageFee(match.tournament_id);
  return feeAmount > 0;
}

async function markRepechageFeePending(match: any, loserId: string, feeAmount: number) {
  const { error } = await supabase
    .from("matches")
    .update({
      repechage_fee_required: true,
      repechage_fee_amount: feeAmount,
      repechage_fee_team_id: loserId,
      repechage_fee_paid: false,
      repechage_fee_paid_at: null,
      admin_note: `Repesaž: čeka uplatu ${feeAmount} €`,
    })
    .eq("id", match.id);

  if (error) throw error;
}

async function placeTeamInMatch(matchId: string | null, slot: string | null, teamId: string | null, teamName: string | null) {
  if (!matchId || !slot || !teamId) return false;

  const { data: targetMatch, error: readError } = await supabase
    .from("matches")
    .select("id,team_a_id,team_b_id,team_a_name,team_b_name,next_match_id,next_match_slot,bracket_type,repechage_forfeit_slot")
    .eq("id", matchId)
    .maybeSingle();

  if (readError) throw readError;
  if (!targetMatch) return false;

  const updatePayload: any =
    slot === "A"
      ? { team_a_id: teamId, team_a_name: teamName || "Ekipa" }
      : { team_b_id: teamId, team_b_name: teamName || "Ekipa" };

  const otherTeamReady = slot === "A" ? Boolean(targetMatch.team_b_id) : Boolean(targetMatch.team_a_id);
  const otherSlotForfeited = targetMatch.repechage_forfeit_slot === (slot === "A" ? "B" : "A");
  updatePayload.status = otherTeamReady ? "scheduled" : otherSlotForfeited ? "finished" : "waiting";

  if (otherSlotForfeited) {
    updatePayload.winner_id = teamId;
    updatePayload.finished_at = new Date().toISOString();
    updatePayload.admin_note = "Automatski prolaz jer protivnik nije uplatio repesaž.";
  }

  const { error: updateError } = await supabase
    .from("matches")
    .update(updatePayload)
    .eq("id", matchId);

  if (updateError) throw updateError;

  if (otherSlotForfeited && targetMatch.next_match_id && targetMatch.next_match_slot) {
    await placeTeamInMatch(targetMatch.next_match_id, targetMatch.next_match_slot, teamId, teamName || "Ekipa");
  }

  return true;
}

async function routeKnockoutMatchAfterResult(match: any) {
  if (!match || match.status !== "finished" || !match.winner_id) return false;
  if (!match.team_a_id || !match.team_b_id) return false;

  const winnerId = match.winner_id;
  const loserId = winnerId === match.team_a_id ? match.team_b_id : match.team_a_id;
  const winnerName = winnerId === match.team_a_id ? match.team_a_name : match.team_b_name;
  const loserName = loserId === match.team_a_id ? match.team_a_name : match.team_b_name;

  if (match.bracket_type === "grand_final") {
    // Ako repesaž finalist dobije prvo finale, igra se reset final.
    if (winnerId === match.team_b_id && match.next_match_id) {
      await placeTeamInMatch(match.next_match_id, "A", match.team_a_id, match.team_a_name);
      await placeTeamInMatch(match.next_match_id, "B", match.team_b_id, match.team_b_name);
      return true;
    }

    return false;
  }

  await placeTeamInMatch(match.next_match_id || null, match.next_match_slot || null, winnerId, winnerName);

  if (await shouldPauseLoserForRepechageFee(match)) {
    const feeAmount = await getTournamentRepechageFee(match.tournament_id);
    await markRepechageFeePending(match, loserId, feeAmount);
    return true;
  }

  await placeTeamInMatch(match.loser_next_match_id || null, match.loser_next_match_slot || null, loserId, loserName);

  return Boolean(match.next_match_id || match.loser_next_match_id);
}

export async function confirmRepechagePaymentAndRoute(matchId: string) {
  if (!matchId) return false;

  const { data: match, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();

  if (error) throw error;
  if (!match) return false;
  if (!match.repechage_fee_required || match.repechage_fee_paid) return false;
  if (!match.loser_next_match_id || !match.loser_next_match_slot) return false;
  if (!match.winner_id || !match.team_a_id || !match.team_b_id) return false;

  const loserId = match.winner_id === match.team_a_id ? match.team_b_id : match.team_a_id;
  const loserName = loserId === match.team_a_id ? match.team_a_name : match.team_b_name;

  await placeTeamInMatch(
    match.loser_next_match_id,
    match.loser_next_match_slot,
    loserId,
    loserName,
  );

  const { error: updateError } = await supabase
    .from("matches")
    .update({
      repechage_fee_paid: true,
      repechage_fee_paid_at: new Date().toISOString(),
      repechage_fee_team_id: loserId,
      admin_note: `Repesaž plaćen ${Number(match.repechage_fee_amount || 10)} €`,
    })
    .eq("id", match.id);

  if (updateError) throw updateError;
  return true;
}

export async function declineRepechagePaymentAndRoute(matchId: string) {
  if (!matchId) return false;

  const { data: match, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();

  if (error) throw error;
  if (!match) return false;
  if (!match.repechage_fee_required || match.repechage_fee_paid) return false;
  if (!match.loser_next_match_id || !match.loser_next_match_slot) return false;
  if (!match.winner_id || !match.team_a_id || !match.team_b_id) return false;

  const loserId = match.winner_id === match.team_a_id ? match.team_b_id : match.team_a_id;
  const loserName = loserId === match.team_a_id ? match.team_a_name : match.team_b_name;

  const { data: targetMatch, error: targetError } = await supabase
    .from("matches")
    .select("id,team_a_id,team_b_id,team_a_name,team_b_name,next_match_id,next_match_slot")
    .eq("id", match.loser_next_match_id)
    .maybeSingle();

  if (targetError) throw targetError;

  const forfeitedSlot = match.loser_next_match_slot === "A" ? "A" : "B";
  const opponentId = forfeitedSlot === "A" ? targetMatch?.team_b_id : targetMatch?.team_a_id;
  const opponentName = forfeitedSlot === "A" ? targetMatch?.team_b_name : targetMatch?.team_a_name;

  const targetUpdate: any = {
    repechage_forfeit_slot: forfeitedSlot,
    status: opponentId ? "finished" : "waiting",
    admin_note: `${loserName || "Ekipa"} nije uplatio/la repesaž i ispada iz turnira.`,
  };

  if (forfeitedSlot === "A") {
    targetUpdate.team_a_id = null;
    targetUpdate.team_a_name = "Nije uplatio repesaž";
  } else {
    targetUpdate.team_b_id = null;
    targetUpdate.team_b_name = "Nije uplatio repesaž";
  }

  if (opponentId) {
    targetUpdate.winner_id = opponentId;
    targetUpdate.finished_at = new Date().toISOString();
  }

  const { error: targetUpdateError } = await supabase
    .from("matches")
    .update(targetUpdate)
    .eq("id", match.loser_next_match_id);

  if (targetUpdateError) throw targetUpdateError;

  const { error: sourceUpdateError } = await supabase
    .from("matches")
    .update({
      repechage_fee_declined: true,
      repechage_fee_declined_at: new Date().toISOString(),
      repechage_fee_team_id: loserId,
      admin_note: `Repesaž nije plaćen — ${loserName || "ekipa"} ispada.`,
    })
    .eq("id", match.id);

  if (sourceUpdateError) throw sourceUpdateError;

  if (opponentId && targetMatch?.next_match_id && targetMatch?.next_match_slot) {
    await placeTeamInMatch(targetMatch.next_match_id, targetMatch.next_match_slot, opponentId, opponentName || "Ekipa");
  }

  return true;
}

export async function syncTournamentAfterResult(match: any) {
  if (!match?.tournament_id) return;

  if (match.phase === "knockout" || ["winners", "repechage", "grand_final", "reset_final"].includes(String(match.bracket_type || ""))) {
    await routeKnockoutMatchAfterResult(match);
  }

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
