export type Team = {
  id: string;
  name: string;
  city?: string;
};

export type MatchInsert = {
  tournament_id: string;
  phase: "knockout" | "group" | "round_robin";
  round: number;
  match_number: number;
  group_name?: string | null;
  bracket_position?: number | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  team_a_name?: string | null;
  team_b_name?: string | null;
  team_a_seed?: string | null;
  team_b_seed?: string | null;
  winner_id?: string | null;
  status: "scheduled" | "bye" | "waiting" | "finished";
};

export type GroupStandingInsert = {
  tournament_id: string;
  group_name: string;
  team_id: string;
  team_name: string;
};

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function nextPowerOfTwo(n: number) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

export function generateKnockoutMatches(
  tournamentId: string,
  teams: Team[]
): MatchInsert[] {
  if (teams.length < 2) {
    throw new Error("Za knockout trebaju barem 2 ekipe.");
  }

  const shuffled = shuffle(teams);
  const bracketSize = nextPowerOfTwo(shuffled.length);
  const totalRounds = Math.log2(bracketSize);

  const slots: (Team | null)[] = Array(bracketSize).fill(null);

  for (let i = 0; i < shuffled.length; i++) {
    slots[i] = shuffled[i];
  }

  const matches: MatchInsert[] = [];
  let globalMatchNumber = 1;

  for (let i = 0; i < bracketSize; i += 2) {
    const teamA = slots[i];
    const teamB = slots[i + 1];

    if (!teamA && !teamB) continue;

    matches.push({
      tournament_id: tournamentId,
      phase: "knockout",
      round: 1,
      match_number: globalMatchNumber,
      bracket_position: i / 2 + 1,
      team_a_id: teamA?.id || null,
      team_b_id: teamB?.id || null,
      team_a_name: teamA?.name || "BYE",
      team_b_name: teamB?.name || "BYE",
      winner_id:
        teamA && !teamB
          ? teamA.id
          : teamB && !teamA
          ? teamB.id
          : null,
      status: teamA && teamB ? "scheduled" : "bye"
    });

    globalMatchNumber++;
  }

  let matchesInPrevRound = matches.filter((m) => m.round === 1).length;

  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = Math.ceil(matchesInPrevRound / 2);

    for (let i = 1; i <= matchesInRound; i++) {
      matches.push({
        tournament_id: tournamentId,
        phase: "knockout",
        round,
        match_number: globalMatchNumber,
        bracket_position: i,
        team_a_id: null,
        team_b_id: null,
        team_a_name: "Pobjednik čeka",
        team_b_name: "Pobjednik čeka",
        team_a_seed: `W${round - 1}-${i * 2 - 1}`,
        team_b_seed: `W${round - 1}-${i * 2}`,
        status: "waiting"
      });

      globalMatchNumber++;
    }

    matchesInPrevRound = matchesInRound;
  }

  return matches;
}

export function generateRoundRobinMatches(
  tournamentId: string,
  teams: Team[]
): MatchInsert[] {
  if (teams.length < 2) {
    throw new Error("Za round robin trebaju barem 2 ekipe.");
  }

  const list = [...teams];
  const matches: MatchInsert[] = [];
  let matchNumber = 1;

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      matches.push({
        tournament_id: tournamentId,
        phase: "round_robin",
        round: 1,
        match_number: matchNumber,
        bracket_position: matchNumber,
        team_a_id: list[i].id,
        team_b_id: list[j].id,
        team_a_name: list[i].name,
        team_b_name: list[j].name,
        status: "scheduled"
      });

      matchNumber++;
    }
  }

  return matches;
}

export function generateGroups(
  tournamentId: string,
  teams: Team[],
  groupSize = 4
): {
  matches: MatchInsert[];
  standings: GroupStandingInsert[];
} {
  if (teams.length < 4) {
    throw new Error("Za grupe trebaju barem 4 ekipe.");
  }

  const shuffled = shuffle(teams);
  const groupCount = Math.ceil(shuffled.length / groupSize);

  const groups: Team[][] = Array.from({ length: groupCount }, () => []);

  shuffled.forEach((team, index) => {
    groups[index % groupCount].push(team);
  });

  const matches: MatchInsert[] = [];
  const standings: GroupStandingInsert[] = [];
  let globalMatchNumber = 1;

  groups.forEach((groupTeams, groupIndex) => {
    const groupName = `Grupa ${String.fromCharCode(65 + groupIndex)}`;

    groupTeams.forEach((team) => {
      standings.push({
        tournament_id: tournamentId,
        group_name: groupName,
        team_id: team.id,
        team_name: team.name
      });
    });

    let groupMatchNumber = 1;

    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        matches.push({
          tournament_id: tournamentId,
          phase: "group",
          round: 1,
          match_number: globalMatchNumber,
          bracket_position: groupMatchNumber,
          group_name: groupName,
          team_a_id: groupTeams[i].id,
          team_b_id: groupTeams[j].id,
          team_a_name: groupTeams[i].name,
          team_b_name: groupTeams[j].name,
          status: "scheduled"
        });

        globalMatchNumber++;
        groupMatchNumber++;
      }
    }
  });

  return { matches, standings };
}

export function generateGroupsKnockoutSeeds(
  tournamentId: string,
  knockoutSize: number
): MatchInsert[] {
  const matches: MatchInsert[] = [];
  let globalMatchNumber = 1;

  for (let i = 0; i < knockoutSize; i += 2) {
    matches.push({
      tournament_id: tournamentId,
      phase: "knockout",
      round: 1,
      match_number: globalMatchNumber,
      bracket_position: i / 2 + 1,
      team_a_id: null,
      team_b_id: null,
      team_a_name: "Nositelj čeka",
      team_b_name: "Nositelj čeka",
      team_a_seed: `K${i + 1}`,
      team_b_seed: `K${i + 2}`,
      status: "waiting"
    });

    globalMatchNumber++;
  }

  const totalRounds = Math.log2(knockoutSize);

  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = knockoutSize / Math.pow(2, round);

    for (let i = 1; i <= matchesInRound; i++) {
      matches.push({
        tournament_id: tournamentId,
        phase: "knockout",
        round,
        match_number: globalMatchNumber,
        bracket_position: i,
        team_a_id: null,
        team_b_id: null,
        team_a_name: "Pobjednik čeka",
        team_b_name: "Pobjednik čeka",
        team_a_seed: `W${round - 1}-${i * 2 - 1}`,
        team_b_seed: `W${round - 1}-${i * 2}`,
        status: "waiting"
      });

      globalMatchNumber++;
    }
  }

  return matches;
}

export function recommendFormat(teamCount: number) {
  if (teamCount <= 8) {
    return {
      format: "round_robin",
      note: "Mali broj ekipa — round robin je najpošteniji."
    };
  }

  if (teamCount <= 32) {
    return {
      format: "knockout",
      note: "Knockout je brz i jednostavan."
    };
  }

  return {
    format: "groups_knockout",
    note: "Za velik broj ekipa najbolje su grupe pa knockout."
  };
}

export function calculateRoundRobinMatchCount(teamCount: number) {
  return (teamCount * (teamCount - 1)) / 2;
}

export function calculateGroupMatchCount(teamCount: number, groupSize = 4) {
  const fullGroups = Math.floor(teamCount / groupSize);
  const remainder = teamCount % groupSize;

  const fullGroupMatches =
    fullGroups * ((groupSize * (groupSize - 1)) / 2);

  const remainderMatches =
    remainder > 1 ? (remainder * (remainder - 1)) / 2 : 0;

  return fullGroupMatches + remainderMatches;
}