"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Params = Promise<{ tournamentId: string }>;

type TeamRow = {
  id: string;
  name?: string | null;
  city?: string | null;
  captain_name?: string | null;
  player_one?: string | null;
  player_two?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type MatchRow = {
  id: string;
  tournament_id: string;
  phase?: string | null;
  round?: number | null;
  match_number?: number | null;
  bracket_position?: number | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  team_a_name?: string | null;
  team_b_name?: string | null;
  score_a?: number | null;
  score_b?: number | null;
  winner_id?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type Standing = {
  team: TeamRow;
  played: number;
  wins: number;
  losses: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  form: string[];
};

function teamName(team?: TeamRow | null) {
  return team?.name || "Nepoznata ekipa";
}

function matchTeamName(match: MatchRow, side: "a" | "b", teamsById: Map<string, TeamRow>) {
  const id = side === "a" ? match.team_a_id : match.team_b_id;
  const fallback = side === "a" ? match.team_a_name : match.team_b_name;
  return (id && teamsById.get(id)?.name) || fallback || "Čeka se ekipa";
}

function isFinished(match: MatchRow) {
  return match.status === "finished" && !!match.winner_id;
}

function isPlayable(match: MatchRow) {
  return match.status === "scheduled" || match.status === "active" || match.status === "live";
}

function buildLeagueTable(teams: TeamRow[], matches: MatchRow[]) {
  const rows = new Map<string, Standing>();

  teams
    .filter((team) => team.status === "approved" || !team.status)
    .forEach((team) => {
      rows.set(team.id, {
        team,
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        diff: 0,
        form: []
      });
    });

  [...matches]
    .filter(isFinished)
    .sort((a, b) => {
      return (
        Number(a.round || 0) - Number(b.round || 0) ||
        Number(a.match_number || 0) - Number(b.match_number || 0) ||
        String(a.created_at || "").localeCompare(String(b.created_at || ""))
      );
    })
    .forEach((match) => {
      if (!match.team_a_id || !match.team_b_id) return;

      const a = rows.get(match.team_a_id);
      const b = rows.get(match.team_b_id);

      if (!a || !b) return;

      const scoreA = Number(match.score_a || 0);
      const scoreB = Number(match.score_b || 0);
      const aWon = match.winner_id === match.team_a_id;
      const bWon = match.winner_id === match.team_b_id;

      a.played += 1;
      b.played += 1;
      a.pointsFor += scoreA;
      a.pointsAgainst += scoreB;
      b.pointsFor += scoreB;
      b.pointsAgainst += scoreA;

      if (aWon) {
        a.wins += 1;
        a.points += 2;
        a.form.push("W");
        b.losses += 1;
        b.form.push("L");
      }

      if (bWon) {
        b.wins += 1;
        b.points += 2;
        b.form.push("W");
        a.losses += 1;
        a.form.push("L");
      }
    });

  return [...rows.values()]
    .map((row) => ({
      ...row,
      diff: row.pointsFor - row.pointsAgainst,
      form: row.form.slice(-5)
    }))
    .sort((a, b) => {
      return (
        b.points - a.points ||
        b.wins - a.wins ||
        b.diff - a.diff ||
        b.pointsFor - a.pointsFor ||
        teamName(a.team).localeCompare(teamName(b.team), "hr")
      );
    });
}

function formatDate(value?: string | null) {
  if (!value) return "Datum nije upisan";

  try {
    return new Date(value).toLocaleDateString("hr-HR");
  } catch {
    return value;
  }
}

export default function LigaPage({ params }: { params: Params }) {
  const { tournamentId } = use(params);

  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`liga-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `tournament_id=eq.${tournamentId}` },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams", filter: `tournament_id=eq.${tournamentId}` },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  async function loadData() {
    setLoading(true);

    const [{ data: tournamentData }, { data: teamData }, { data: matchData }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
      supabase
        .from("teams")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: true }),
      supabase
        .from("matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("round", { ascending: true })
        .order("match_number", { ascending: true })
    ]);

    setTournament(tournamentData || null);
    setTeams((teamData || []) as TeamRow[]);
    setMatches((matchData || []) as MatchRow[]);
    setLoading(false);
  }

  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const leagueMatches = useMemo(() => matches.filter((match) => match.phase === "round_robin" || tournament?.tournament_format === "round_robin"), [matches, tournament?.tournament_format]);
  const table = useMemo(() => buildLeagueTable(teams, leagueMatches), [teams, leagueMatches]);
  const finishedMatches = leagueMatches.filter(isFinished);
  const playableMatches = leagueMatches.filter(isPlayable);
  const totalMatches = leagueMatches.length;
  const progress = totalMatches > 0 ? Math.round((finishedMatches.length / totalMatches) * 100) : 0;

  const matchesByRound = useMemo(() => {
    return leagueMatches.reduce<Record<string, MatchRow[]>>((acc, match) => {
      const round = String(match.round || 1);
      if (!acc[round]) acc[round] = [];
      acc[round].push(match);
      return acc;
    }, {});
  }, [leagueMatches]);

  const nextRound = useMemo(() => {
    const open = playableMatches
      .map((match) => Number(match.round || 1))
      .sort((a, b) => a - b)[0];

    return open || null;
  }, [playableMatches]);

  if (loading) {
    return (
      <main className="page">
        <div className="card muted">Učitavam ligu...</div>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="page">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-red-300">
          Liga/turnir nije pronađen.
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero-card mb-10">
        <span className="badge">Liga sustav</span>

        <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div>
            <h1 className="page-title">{tournament.name}</h1>
            <p className="muted mt-4 text-lg">
              {tournament.location || "Lokacija nije upisana"} · {formatDate(tournament.starts_at)}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <MiniBadge label={`${table.length} ekipa`} />
              <MiniBadge label={`${finishedMatches.length}/${totalMatches} mečeva odigrano`} />
              <MiniBadge label={`Napredak ${progress}%`} />
              {nextRound && <MiniBadge label={`Sljedeća runda: ${nextRound}`} />}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href={`/tournament/${tournamentId}`} className="btn-outline">
              Javni turnir
            </a>
            <a href={`/dashboard/${tournamentId}`} target="_blank" rel="noopener noreferrer" className="btn-primary">
              TV dashboard
            </a>
          </div>
        </div>
      </section>

      <section className="mb-10 grid gap-4 md:grid-cols-4">
        <Stat title="Prvo mjesto" value={table[0] ? teamName(table[0].team) : "-"} />
        <Stat title="Najviše pobjeda" value={table[0] ? String(table[0].wins) : "0"} />
        <Stat title="Odigrano" value={`${finishedMatches.length}/${totalMatches}`} />
        <Stat title="Preostalo" value={String(Math.max(0, totalMatches - finishedMatches.length))} />
      </section>

      <section className="mb-10 card overflow-hidden p-0">
        <div className="border-b border-[#d4b06a]/10 p-6">
          <h2 className="section-title">Liga tablica</h2>
          <p className="muted mt-2">
            Poredak se računa iz svih završenih ligaških mečeva: 2 boda za pobjedu, zatim pobjede, razlika i ukupni bodovi.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-[#081a14] text-sm uppercase tracking-[0.2em] text-[#d4b06a]">
              <tr>
                <th className="px-4 py-4">#</th>
                <th className="px-4 py-4">Ekipa</th>
                <th className="px-4 py-4 text-center">O</th>
                <th className="px-4 py-4 text-center">Pob</th>
                <th className="px-4 py-4 text-center">Por</th>
                <th className="px-4 py-4 text-center">Bod</th>
                <th className="px-4 py-4 text-center">Za</th>
                <th className="px-4 py-4 text-center">Protiv</th>
                <th className="px-4 py-4 text-center">Razlika</th>
                <th className="px-4 py-4">Forma</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, index) => (
                <tr key={row.team.id} className="border-t border-white/5 odd:bg-white/[0.02]">
                  <td className="px-4 py-4 font-black text-[#d4b06a]">{index + 1}</td>
                  <td className="px-4 py-4">
                    <a href={`/ekipa/${row.team.id}`} className="font-black text-[#f3dfad] hover:text-[#d4b06a]">
                      {teamName(row.team)}
                    </a>
                    <p className="text-sm text-white/50">{row.team.city || "Grad nije upisan"}</p>
                  </td>
                  <td className="px-4 py-4 text-center">{row.played}</td>
                  <td className="px-4 py-4 text-center text-green-300">{row.wins}</td>
                  <td className="px-4 py-4 text-center text-red-300">{row.losses}</td>
                  <td className="px-4 py-4 text-center font-black text-[#d4b06a]">{row.points}</td>
                  <td className="px-4 py-4 text-center">{row.pointsFor}</td>
                  <td className="px-4 py-4 text-center">{row.pointsAgainst}</td>
                  <td className={`px-4 py-4 text-center font-bold ${row.diff >= 0 ? "text-green-300" : "text-red-300"}`}>
                    {row.diff > 0 ? "+" : ""}{row.diff}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      {row.form.length === 0 && <span className="text-white/40">-</span>}
                      {row.form.map((item, formIndex) => (
                        <span
                          key={`${row.team.id}-${formIndex}`}
                          className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${item === "W" ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="section-title">Runde lige</h2>
        <p className="muted mt-2">
          Ovo je raspored svatko sa svakim. Runda se otključava kako se rezultati upisuju u postojeći sustav mečeva.
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {Object.entries(matchesByRound)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([round, roundMatches]) => (
              <div key={round} className="card-soft">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black text-[#d4b06a]">Runda {round}</h3>
                  <span className="rounded-full bg-black/20 px-3 py-1 text-sm text-white/60">
                    {roundMatches.filter(isFinished).length}/{roundMatches.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {roundMatches.map((match) => (
                    <a
                      key={match.id}
                      href={match.status === "waiting" ? `/live/${match.id}` : `/mec/${match.id}`}
                      className="block rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-[#d4b06a]/40 hover:bg-[#d4b06a]/10"
                    >
                      <div className="flex items-center justify-between gap-3 text-sm text-white/50">
                        <span>Meč {match.match_number}</span>
                        <StatusPill status={match.status || "scheduled"} />
                      </div>

                      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <TeamName name={matchTeamName(match, "a", teamsById)} teamId={match.team_a_id} />
                        <div className="rounded-xl bg-[#081a14] px-3 py-2 text-center font-black text-[#f3dfad]">
                          {Number(match.score_a || 0)} : {Number(match.score_b || 0)}
                        </div>
                        <TeamName name={matchTeamName(match, "b", teamsById)} teamId={match.team_b_id} right />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="card-soft">
        <h2 className="text-2xl font-black text-[#f3dfad]">Kako liga radi?</h2>
        <p className="muted mt-3">
          Liga koristi postojeći round robin ždrijeb: svaka ekipa igra protiv svake. Tablica se osvježava realtime nakon svakog upisanog rezultata. Pobjeda vrijedi 2 boda, a kod izjednačenja odlučuju pobjede, razlika bodova i ukupno osvojeni bodovi.
        </p>
      </section>
    </main>
  );
}

function MiniBadge({ label }: { label: string }) {
  return <span className="badge">{label}</span>;
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="card-soft">
      <p className="text-sm uppercase tracking-[0.2em] text-white/40">{title}</p>
      <p className="mt-2 text-2xl font-black text-[#f3dfad]">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    finished: "Završeno",
    scheduled: "Otključano",
    active: "Live",
    live: "Live",
    waiting: "Čeka",
    bye: "BYE"
  };

  const color =
    status === "finished"
      ? "bg-green-500/20 text-green-300"
      : status === "waiting"
      ? "bg-zinc-500/20 text-zinc-300"
      : status === "bye"
      ? "bg-blue-500/20 text-blue-300"
      : "bg-[#d4b06a]/20 text-[#d4b06a]";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${color}`}>
      {labelMap[status] || status}
    </span>
  );
}

function TeamName({ name, teamId, right = false }: { name: string; teamId?: string | null; right?: boolean }) {
  const className = `font-bold text-[#f3dfad] hover:text-[#d4b06a] ${right ? "text-right" : ""}`;

  if (!teamId) {
    return <span className={className}>{name}</span>;
  }

  return (
    <a href={`/ekipa/${teamId}`} className={className}>
      {name}
    </a>
  );
}
