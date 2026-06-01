export type Team = {
  id: string;
  name: string;
  city?: string;
  seed_score?: number;
  seed_rank?: number;
  created_at?: string;
  registered_at?: string;
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

function getSeedScore(team: Team) {
  return Number.isFinite(Number(team.seed_score)) ? Number(team.seed_score) : 1000;
}

function getRegistrationTime(team: Team) {
  const rawDate = team.created_at || team.registered_at || "";
  const time = new Date(rawDate).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function buildSeededGroups(teams: Team[], groupSize: number, seedCount = 8) {
  const groupCount = Math.ceil(teams.length / groupSize);
  const groups: Team[][] = Array.from({ length: groupCount }, () => []);

  const orderedByStrength = [...teams].sort((a, b) => {
    return (
      getSeedScore(b) - getSeedScore(a) ||
      getRegistrationTime(a) - getRegistrationTime(b) ||
      String(a.name || "").localeCompare(String(b.name || ""), "hr")
    );
  });

  const seeds = orderedByStrength.slice(0, Math.min(seedCount, orderedByStrength.length));
  const seedIds = new Set(seeds.map((team) => team.id));

  const forward = Array.from({ length: groupCount }, (_, index) => index);
  const backward = [...forward].reverse();
  const snakeOrder = [...forward, ...backward];

  seeds.forEach((team, index) => {
    const groupIndex = snakeOrder[index % snakeOrder.length];
    groups[groupIndex].push({ ...team, seed_rank: index + 1 });
  });

  const remainingTeams = shuffle(teams.filter((team) => !seedIds.has(team.id)));

  remainingTeams.forEach((team) => {
    const notFullGroups = groups.filter((group) => group.length < groupSize);
    const availableGroups = notFullGroups.length > 0 ? notFullGroups : groups;
    const minSize = Math.min(...availableGroups.map((group) => group.length));
    const candidates = availableGroups.filter((group) => group.length === minSize);
    const targetGroup = candidates[Math.floor(Math.random() * candidates.length)];

    targetGroup.push(team);
  });

  return groups;
}

function generateBergerRounds(teams: Team[]) {
  const list: (Team | null)[] = [...teams];

  if (list.length % 2 === 1) {
    list.push(null);
  }

  const rounds: { teamA: Team; teamB: Team }[][] = [];
  const count = list.length;
  const half = count / 2;
  const rotating = [...list];

  for (let roundIndex = 0; roundIndex < count - 1; roundIndex++) {
    const roundPairs: { teamA: Team; teamB: Team }[] = [];

    for (let i = 0; i < half; i++) {
      const left = rotating[i];
      const right = rotating[count - 1 - i];

      if (!left || !right) continue;

      const swapHomeAway = roundIndex % 2 === 1;

      roundPairs.push({
        teamA: swapHomeAway ? right : left,
        teamB: swapHomeAway ? left : right,
      });
    }

    rounds.push(roundPairs);

    const fixed = rotating[0];
    const rest = rotating.slice(1);
    const last = rest.pop();
    rotating.splice(0, rotating.length, fixed, last || null, ...rest);
  }

  return rounds;
}

export function generateKnockoutMatches(
  tournamentId: string,
  teams: Team[],
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
      winner_id: teamA && !teamB ? teamA.id : teamB && !teamA ? teamB.id : null,
      status: teamA && teamB ? "scheduled" : "bye",
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
        status: "waiting",
      });

      globalMatchNumber++;
    }

    matchesInPrevRound = matchesInRound;
  }

  return matches;
}

export function generateRoundRobinMatches(
  tournamentId: string,
  teams: Team[],
  leagueRounds = 1,
): MatchInsert[] {
  if (teams.length < 2) {
    throw new Error("Za round robin trebaju barem 2 ekipe.");
  }

  const matches: MatchInsert[] = [];
  let matchNumber = 1;
  const bergerRounds = generateBergerRounds(teams);
  const repeats = Math.max(1, Number(leagueRounds || 1));

  for (let repeat = 0; repeat < repeats; repeat++) {
    bergerRounds.forEach((roundPairs, roundIndex) => {
      const roundNumber = repeat * bergerRounds.length + roundIndex + 1;

      roundPairs.forEach((pair, index) => {
        const swapSides = repeat % 2 === 1;
        const teamA = swapSides ? pair.teamB : pair.teamA;
        const teamB = swapSides ? pair.teamA : pair.teamB;

        matches.push({
          tournament_id: tournamentId,
          phase: "round_robin",
          round: roundNumber,
          match_number: matchNumber,
          bracket_position: index + 1,
          team_a_id: teamA.id,
          team_b_id: teamB.id,
          team_a_name: teamA.name,
          team_b_name: teamB.name,
          status: roundNumber === 1 ? "scheduled" : "waiting",
        });

        matchNumber++;
      });
    });
  }

  return matches;
}


export function generateLimitedLeagueMatches(
  tournamentId: string,
  teams: Team[],
  matchesPerTeam = 8,
): MatchInsert[] {
  if (teams.length < 2) {
    throw new Error("Za liga fazu trebaju barem 2 ekipe.");
  }

  const maxRounds = teams.length % 2 === 0 ? teams.length - 1 : teams.length;
  const requestedRounds = Math.max(1, Number(matchesPerTeam || 1));
  const roundsToUse = Math.min(requestedRounds, maxRounds);
  const bergerRounds = generateBergerRounds(teams);
  const matches: MatchInsert[] = [];
  let matchNumber = 1;

  for (let roundIndex = 0; roundIndex < roundsToUse; roundIndex++) {
    const roundPairs = bergerRounds[roundIndex % bergerRounds.length] || [];
    const roundNumber = roundIndex + 1;

    roundPairs.forEach((pair, index) => {
      matches.push({
        tournament_id: tournamentId,
        phase: "round_robin",
        round: roundNumber,
        match_number: matchNumber,
        bracket_position: index + 1,
        team_a_id: pair.teamA.id,
        team_b_id: pair.teamB.id,
        team_a_name: pair.teamA.name,
        team_b_name: pair.teamB.name,
        status: roundNumber === 1 ? "scheduled" : "waiting",
      });

      matchNumber++;
    });
  }

  return matches;
}

export function generateGroups(
  tournamentId: string,
  teams: Team[],
  groupSize = 4,
): {
  matches: MatchInsert[];
  standings: GroupStandingInsert[];
} {
  if (teams.length < 4) {
    throw new Error("Za grupe trebaju barem 4 ekipe.");
  }

  const groups = buildSeededGroups(teams, groupSize, 8);

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
        team_name: team.name,
      });
    });

    const bergerRounds = generateBergerRounds(groupTeams);

    bergerRounds.forEach((roundPairs, roundIndex) => {
      roundPairs.forEach((pair, index) => {
        matches.push({
          tournament_id: tournamentId,
          phase: "group",
          round: roundIndex + 1,
          match_number: globalMatchNumber,
          bracket_position: index + 1,
          group_name: groupName,
          team_a_id: pair.teamA.id,
          team_b_id: pair.teamB.id,
          team_a_name: pair.teamA.name,
          team_b_name: pair.teamB.name,
          status: roundIndex === 0 ? "scheduled" : "waiting",
        });

        globalMatchNumber++;
      });
    });
  });

  return { matches, standings };
}

export function generateGroupsKnockoutSeeds(
  tournamentId: string,
  knockoutSize: number,
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
      status: "waiting",
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
        status: "waiting",
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
      note: "Mali broj ekipa — round robin je najpošteniji.",
    };
  }

  if (teamCount <= 32) {
    return {
      format: "knockout",
      note: "Knockout je brz i jednostavan.",
    };
  }

  return {
    format: "groups_knockout",
    note: "Za velik broj ekipa najbolje su grupe pa knockout.",
  };
}

export function calculateRoundRobinMatchCount(teamCount: number, leagueRounds = 1) {
  return ((teamCount * (teamCount - 1)) / 2) * Math.max(1, Number(leagueRounds || 1));
}

export function calculateLimitedLeagueMatchCount(teamCount: number, matchesPerTeam = 8) {
  if (teamCount < 2) return 0;

  const maxRounds = teamCount % 2 === 0 ? teamCount - 1 : teamCount;
  const roundsToUse = Math.min(Math.max(1, Number(matchesPerTeam || 1)), maxRounds);

  return Math.floor(teamCount / 2) * roundsToUse;
}

export function calculateGroupMatchCount(teamCount: number, groupSize = 4) {
  const fullGroups = Math.floor(teamCount / groupSize);
  const remainder = teamCount % groupSize;

  const fullGroupMatches = fullGroups * ((groupSize * (groupSize - 1)) / 2);

  const remainderMatches =
    remainder > 1 ? (remainder * (remainder - 1)) / 2 : 0;

  return fullGroupMatches + remainderMatches;
}
