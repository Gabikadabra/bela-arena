"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type TeamProfileParams = Promise<{ id: string }>;

export default function EkipaProfilePage({ params }: { params: TeamProfileParams }) {
  const { id } = use(params);

  const [team, setTeam] = useState<any>(null);
  const [statsRows, setStatsRows] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [opponentTeams, setOpponentTeams] = useState<any[]>([]);
  const [manualAchievements, setManualAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTeamProfile();

    const channel = supabase
      .channel(`ekipa-profile-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `id=eq.${id}` }, () => loadTeamProfile(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => loadTeamProfile(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "match_games" }, () => loadTeamProfile(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "team_ranking_stats" }, () => loadTeamProfile(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "team_elo_history" }, () => loadTeamProfile(false))
      .on("postgres_changes", { event: "*", schema: "public", table: "team_manual_achievements", filter: `team_id=eq.${id}` }, () => loadTeamProfile(false))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function loadTeamProfile(showLoader = true) {
    if (showLoader) setLoading(true);

    const { data: teamData } = await supabase
      .from("teams")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    setTeam(teamData);

    const { data: tournamentData } = await supabase
      .from("tournaments")
      .select("*")
      .order("starts_at", { ascending: false });

    setTournaments(tournamentData || []);

    const { data: statData } = await supabase
      .from("team_ranking_stats")
      .select("*")
      .eq("team_id", id);

    setStatsRows(statData || []);

    const { data: manualAchievementData } = await supabase
      .from("team_manual_achievements")
      .select("*")
      .eq("team_id", id)
      .order("created_at", { ascending: false });

    setManualAchievements(manualAchievementData || []);

    const { data: matchData } = await supabase
      .from("matches")
      .select("*")
      .or(`team_a_id.eq.${id},team_b_id.eq.${id}`)
      .order("created_at", { ascending: false });

    setMatches(matchData || []);

    const safeMatches = matchData || [];
    const matchIds = safeMatches.map((match) => match.id);
    const opponentIds = Array.from(
      new Set(
        safeMatches
          .map((match) => (match.team_a_id === id ? match.team_b_id : match.team_a_id))
          .filter(Boolean)
      )
    );

    if (opponentIds.length > 0) {
      const { data: opponentData } = await supabase
        .from("teams")
        .select("id,name,team_name,city,player_one,player_two,captain_name")
        .in("id", opponentIds);

      setOpponentTeams(opponentData || []);
    } else {
      setOpponentTeams([]);
    }

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

  const tournamentById = useMemo(() => {
    return new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  }, [tournaments]);

  const teamById = useMemo(() => {
    return new Map(opponentTeams.map((opponent) => [opponent.id, opponent]));
  }, [opponentTeams]);

  const headToHeadStats = useMemo(() => {
    return calculateHeadToHeadStats(id, matches, teamById);
  }, [id, matches, teamById]);

  const profileStats = useMemo(() => {
    const finishedMatches = matches.filter((match) => match.status === "finished");
    const wins = finishedMatches.filter((match) => match.winner_id === id).length;
    const losses = finishedMatches.length - wins;
    const activeMatches = matches.filter((match) => match.status !== "finished").length;
    const totalPoints = statsRows.reduce((sum, row) => sum + Number(row.total_points || 0), 0);
    const totalDeclarations = statsRows.reduce((sum, row) => sum + Number(row.total_declarations || 0), 0);
    const bestSingleDeal = statsRows.reduce((best, row) => Math.max(best, Number(row.best_single_deal || 0)), 0);
    const bestSingleGameDeclarations = calculateBestSingleGameDeclarations(id, matches, games);
    const winrate = finishedMatches.length > 0 ? Math.round((wins / finishedMatches.length) * 100) : 0;
    const currentElo = calculateChessElo(id, finishedMatches);
    const lastFive = finishedMatches.slice(0, 5).map((match) => (match.winner_id === id ? "W" : "L"));

    return {
      activeMatches,
      bestSingleDeal,
      bestSingleGameDeclarations,
      currentElo,
      finishedMatches: finishedMatches.length,
      lastFive,
      losses,
      totalDeclarations,
      totalMatches: matches.length,
      totalPoints,
      wins,
      winrate,
    };
  }, [id, matches, statsRows, games]);

  const achievements = useMemo(() => {
    return calculateAchievements(profileStats, headToHeadStats, manualAchievements);
  }, [profileStats, headToHeadStats, manualAchievements]);

  if (loading) {
    return (
      <main className="page">
        <p className="text-zinc-300">Učitavam profil ekipe...</p>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="page">
        <div className="card">
          <h1 className="text-4xl font-black text-[#f3dfad]">Ekipa nije pronađena</h1>
          <p className="mt-4 text-zinc-300">Provjeri link ili odaberi ekipu iz rang-liste.</p>
          <a href="/rang-lista" className="mt-6 inline-flex btn-primary">Rang-lista</a>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
            Profil ekipe
          </p>
          <h1 className="text-4xl font-black text-[#f3dfad] sm:text-6xl">
            {team.name || team.team_name || "Ekipa bez imena"}
          </h1>
          <p className="mt-4 max-w-3xl text-zinc-300">
            Pregled ekipe, igrača, ELO-a, omjera pobjeda, rekordnih zvanja i zadnjih mečeva.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a href="/rang-lista" className="btn-outline">Rang-lista</a>
          {team.tournament_id && (
            <a href={`/tournament/${team.tournament_id}`} className="btn-primary">Turnir ekipe</a>
          )}
        </div>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ProfileStat title="ELO" value={profileStats.currentElo} sub="šahovski obračun po meču" />
        <ProfileStat title="Omjer" value={`${profileStats.wins}-${profileStats.losses}`} sub={`${profileStats.winrate}% pobjeda`} />
        <ProfileStat title="Mečevi" value={profileStats.totalMatches} sub={`${profileStats.activeMatches} aktivnih`} />
        <ProfileStat title="Zvanja / partija" value={profileStats.bestSingleGameDeclarations} sub="rekord u jednoj partiji" />
      </section>

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="card">
          <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Podaci ekipe</h2>

          <div className="mt-6 grid gap-3 text-zinc-300">
            <TeamInfo label="Naziv" value={team.name || team.team_name} />
            <TeamInfo label="Grad" value={team.city} />
            <TeamInfo label="Kapetan" value={team.captain_name || team.captain} />
            <TeamInfo label="Igrač 1" value={team.player_one || team.playerOne} />
            <TeamInfo label="Igrač 2" value={team.player_two || team.playerTwo} />
            <TeamInfo label="Partner email" value={team.partner_email} />
            <TeamInfo label="Telefon" value={team.phone} />
            <TeamInfo label="Status prijave" value={team.status} />
            <TeamInfo label="Poziv partneru" value={team.invite_status} />
          </div>
        </section>

        <section className="card">
          <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Statistika</h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <ProfileStat title="Ukupno bodova" value={profileStats.totalPoints} sub="iz rang-liste" />
            <ProfileStat title="Ukupno zvanja" value={profileStats.totalDeclarations} sub="sve partije" />
            <ProfileStat title="Najbolje dijeljenje" value={profileStats.bestSingleDeal} sub="najviše bodova u dijeljenju" />
            <ProfileStat title="Forma" value={profileStats.lastFive.length ? profileStats.lastFive.join(" ") : "-"} sub="zadnjih 5 završenih mečeva" />
          </div>
        </section>
      </div>

      <section className="mt-8 card">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Međusobni susreti</h2>
            <p className="mt-2 text-zinc-400">Omjer ove ekipe protiv svih protivnika koje je već srela.</p>
          </div>
          <span className="rounded-full border border-[#d4b06a]/20 bg-[#d4b06a]/10 px-4 py-2 text-sm font-bold text-[#d4b06a]">
            {headToHeadStats.length} protivnika
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {headToHeadStats.length === 0 && (
            <div className="card-soft text-zinc-300">Još nema završenih međusobnih susreta.</div>
          )}

          {headToHeadStats.slice(0, 8).map((row) => (
            <HeadToHeadCard key={row.opponentId} row={row} />
          ))}
        </div>
      </section>

      <section className="mt-8 card">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Medalje i achievementi</h2>
            <p className="mt-2 text-zinc-400">Automatske značke prema statistici i posebne medalje koje admin ručno dodjeljuje ekipama.</p>
          </div>
          <span className="rounded-full border border-[#d4b06a]/20 bg-[#d4b06a]/10 px-4 py-2 text-sm font-bold text-[#d4b06a]">
            {achievements.length} osvojeno
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {achievements.length === 0 && (
            <div className="card-soft text-zinc-300">Još nema medalja. Prve dolaze nakon pobjeda, zvanja ili boljeg ELO-a.</div>
          )}

          {achievements.map((achievement) => (
            <AchievementCard key={achievement.title} achievement={achievement} />
          ))}
        </div>
      </section>

      <section className="mt-8 card">
        <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Zadnji mečevi</h2>
        <p className="mt-2 text-zinc-400">Zadnji rezultati ove ekipe, s linkom na live prikaz ili unos rezultata.</p>

        <div className="mt-6 space-y-4">
          {matches.length === 0 && (
            <div className="card-soft text-zinc-300">Ova ekipa još nema mečeva.</div>
          )}

          {matches.slice(0, 12).map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              teamId={id}
              tournament={tournamentById.get(match.tournament_id)}
              opponent={teamById.get(match.team_a_id === id ? match.team_b_id : match.team_a_id)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

type HeadToHeadRow = {
  opponentId: string;
  opponentName: string;
  opponentCity?: string;
  totalMatches: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  averageDiff: number;
  lastMatch?: any;
  lastResult: string;
};

type Achievement = {
  emoji: string;
  title: string;
  description: string;
  tone: "gold" | "green" | "blue" | "purple" | "red";
  source?: "auto" | "admin";
  note?: string;
};

const ADMIN_ACHIEVEMENT_CATALOG: Record<string, Achievement> = {
  bela_arena_legend: { emoji: "👑", title: "Legenda Bele Arene", description: "Najveća posebna titula za ekipu koja je obilježila Bela Arenu i ostavila trag kroz turnire.", tone: "gold", source: "admin" },
  fair_play: { emoji: "🤝", title: "Fair Play ekipa", description: "Ekipa poznata po poštenoj igri i sportskom duhu.", tone: "green", source: "admin" },
  best_duo: { emoji: "🧬", title: "Najbolji dvojac", description: "Admin priznanje za par koji djeluje kao savršena kombinacija.", tone: "purple", source: "admin" },
  tournament_hero: { emoji: "🦸", title: "Heroji turnira", description: "Za ekipu koja je izvukla nemoguće ili nosila atmosferu turnira.", tone: "blue", source: "admin" },
  crowd_favorite: { emoji: "📣", title: "Miljenici publike", description: "Ekipa koju publika najviše prati, komentira i bodri.", tone: "gold", source: "admin" },
  comeback_kings_manual: { emoji: "🔁", title: "Kraljevi comebacka", description: "Ručna titula za najluđi povratak dok ne postoji detaljan unos tijeka partije.", tone: "red", source: "admin" },
  captain_of_the_night: { emoji: "🧢", title: "Kapetan večeri", description: "Za vodstvo, komunikaciju i kontrolu ritma igre.", tone: "blue", source: "admin" },
  clutch_team: { emoji: "⏱️", title: "Clutch ekipa", description: "Ekipa koja najbolje odigra kada je najnapetije.", tone: "red", source: "admin" },
  showtime_team: { emoji: "🎭", title: "Showtime ekipa", description: "Ekipa koja od svakog meča napravi predstavu.", tone: "purple", source: "admin" },
  silent_killers: { emoji: "🥷", title: "Tihi ubojice", description: "Mirna ekipa koja ne priča puno, ali stalno radi štetu.", tone: "blue", source: "admin" },
  table_bosses: { emoji: "🪑", title: "Gazde stola", description: "Ekipa koja djeluje kao da je stol njihov teren.", tone: "gold", source: "admin" },
  respect_team: { emoji: "🫡", title: "Ekipa za respekt", description: "Ekipa koju svi poštuju bez obzira na rezultat.", tone: "green", source: "admin" },
  underdog_story: { emoji: "🐺", title: "Underdog priča", description: "Nisu bili favoriti, ali su napravili veliki rezultat.", tone: "red", source: "admin" },
  golden_pair: { emoji: "🥇", title: "Zlatni par", description: "Posebno dobra kombinacija igrača.", tone: "gold", source: "admin" },
  iron_mentality: { emoji: "🧠", title: "Čelična glava", description: "Ekipa koja se ne raspada pod pritiskom.", tone: "blue", source: "admin" },
  arena_icon: { emoji: "🏟️", title: "Ikone arene", description: "Ekipa koja je postala prepoznatljiv dio turnira.", tone: "purple", source: "admin" },
  most_fun_team: { emoji: "😂", title: "Najzabavnija ekipa", description: "Najbolja atmosfera, fore i energija.", tone: "green", source: "admin" },
  ice_in_veins: { emoji: "🧊", title: "Led u venama", description: "Hladnokrvne završnice i mirna ruka.", tone: "blue", source: "admin" },
  card_wizards: { emoji: "🪄", title: "Majstori karata", description: "Ekipa s potezima za pamćenje.", tone: "purple", source: "admin" },
  honorary_champions: { emoji: "🏅", title: "Počasni prvaci", description: "Poseban doprinos čak i bez prvog mjesta.", tone: "gold", source: "admin" },
  never_give_up: { emoji: "💪", title: "Nema predaje", description: "Borba do zadnje karte.", tone: "red", source: "admin" },
  clean_game: { emoji: "🧼", title: "Čista igra", description: "Bez rasprava, natezanja i problema.", tone: "green", source: "admin" },
  big_match_team: { emoji: "🌟", title: "Ekipa za velike mečeve", description: "Ekipa koja se posebno digne u velikim utakmicama.", tone: "purple", source: "admin" },
  organizer_pick: { emoji: "✅", title: "Izbor organizatora", description: "Posebna admin medalja za ekipu koju organizator želi istaknuti.", tone: "blue", source: "admin" },
  hall_of_fame: { emoji: "🏛️", title: "Hall of Fame", description: "Trajna elitna titula za ekipe koje ulaze u povijest Bele Arene.", tone: "gold", source: "admin" },
};

function calculateAchievements(profileStats: any, headToHeadStats: HeadToHeadRow[], manualRows: any[]): Achievement[] {
  const achievements: Achievement[] = [];

  for (const row of manualRows || []) {
    const catalog = ADMIN_ACHIEVEMENT_CATALOG[row.achievement_key] || {
      emoji: row.emoji || "🏅",
      title: row.title || "Posebna medalja",
      description: row.description || "Ručno dodijeljena admin medalja.",
      tone: row.tone || "gold",
      source: "admin",
    };

    achievements.push({
      ...catalog,
      emoji: row.emoji || catalog.emoji,
      title: row.title || catalog.title,
      description: row.description || catalog.description,
      tone: row.tone || catalog.tone,
      source: "admin",
      note: row.note,
    });
  }

  const addAuto = (condition: boolean, achievement: Achievement) => {
    if (condition) achievements.push({ ...achievement, source: "auto" });
  };

  const lastFiveWins = (profileStats.lastFive || []).filter((item: string) => item === "W").length;
  const positiveHeadToHead = headToHeadStats.filter((row) => row.totalMatches >= 2 && row.wins > row.losses).length;
  const unbeatenRival = headToHeadStats.find((row) => row.totalMatches >= 3 && row.losses === 0);
  const dominantRival = headToHeadStats.find((row) => row.totalMatches >= 3 && row.averageDiff >= 30);
  const avgPoints = profileStats.finishedMatches > 0 ? Math.round(profileStats.totalPoints / profileStats.finishedMatches) : 0;

  addAuto(profileStats.totalMatches >= 1, { emoji: "🪙", title: "Prvi meč", description: "Ekipa je upisala prvi nastup u Bela Areni.", tone: "blue" });
  addAuto(profileStats.wins > 0, { emoji: "🏆", title: "Prva pobjeda", description: `Ekipa ima ${profileStats.wins} pobjeda ukupno.`, tone: "gold" });
  addAuto(profileStats.finishedMatches >= 3 && profileStats.losses === 0, { emoji: "🔥", title: "Neporaženi", description: `Bez poraza kroz ${profileStats.finishedMatches} završenih mečeva.`, tone: "green" });
  addAuto(profileStats.currentElo >= 1100, { emoji: "♟️", title: "ELO majstor", description: `Prešli su ${profileStats.currentElo} ELO po šahovskom obračunu.`, tone: "blue" });
  addAuto(profileStats.currentElo >= 1200, { emoji: "💎", title: "Elitni ELO", description: `ELO od ${profileStats.currentElo} znači da su među najopasnijim ekipama.`, tone: "purple" });
  addAuto(profileStats.currentElo >= 1300, { emoji: "👑", title: "ELO kraljevi", description: `S ${profileStats.currentElo} ELO ulaze u elitni rang Bele Arene.`, tone: "gold" });
  addAuto(profileStats.bestSingleGameDeclarations >= 50, { emoji: "🗣️", title: "Kraljevi zvanja", description: `Rekord im je ${profileStats.bestSingleGameDeclarations} zvanja u jednoj partiji.`, tone: "purple" });
  addAuto(profileStats.bestSingleGameDeclarations >= 90, { emoji: "💥", title: "Zvanje bomba", description: `U jednoj partiji su došli do ${profileStats.bestSingleGameDeclarations} zvanja.`, tone: "red" });
  addAuto(profileStats.totalDeclarations >= 200, { emoji: "📢", title: "Glasni za stolom", description: `Ukupno imaju ${profileStats.totalDeclarations} zvanja.`, tone: "gold" });
  addAuto(profileStats.totalDeclarations >= 500, { emoji: "🎺", title: "Orkestar zvanja", description: `Prešli su ${profileStats.totalDeclarations} ukupnih zvanja.`, tone: "purple" });
  addAuto(profileStats.totalMatches >= 5, { emoji: "🧱", title: "Stalni sudionici", description: `Već imaju ${profileStats.totalMatches} mečeva u Bela Areni.`, tone: "blue" });
  addAuto(profileStats.totalMatches >= 10, { emoji: "🎖️", title: "Iskusna ekipa", description: `Odigrali su ${profileStats.totalMatches} mečeva kroz turnire.`, tone: "gold" });
  addAuto(profileStats.totalMatches >= 25, { emoji: "🛡️", title: "Veterani arene", description: `S ${profileStats.totalMatches} mečeva spadaju među najiskusnije ekipe.`, tone: "purple" });
  addAuto(profileStats.totalMatches >= 50, { emoji: "🏟️", title: "Legende sezone", description: `Nevjerojatnih ${profileStats.totalMatches} mečeva u sustavu.`, tone: "gold" });
  addAuto(profileStats.finishedMatches >= 5 && profileStats.winrate >= 60, { emoji: "🥉", title: "Pozitivan omjer", description: `${profileStats.winrate}% pobjeda kroz ${profileStats.finishedMatches} završenih mečeva.`, tone: "green" });
  addAuto(profileStats.finishedMatches >= 5 && profileStats.winrate >= 70, { emoji: "🥈", title: "Jaka pobjednička stopa", description: `${profileStats.winrate}% pobjeda pokazuje ozbiljnu konstantu.`, tone: "green" });
  addAuto(profileStats.finishedMatches >= 8 && profileStats.winrate >= 85, { emoji: "🥇", title: "Elitna pobjednička stopa", description: `${profileStats.winrate}% pobjeda protiv konkurencije.`, tone: "gold" });
  addAuto(lastFiveWins >= 3, { emoji: "🌪️", title: "Opasna forma", description: `${lastFiveWins} pobjeda u zadnjih 5 završenih mečeva.`, tone: "green" });
  addAuto(lastFiveWins >= 4, { emoji: "⚡", title: "Forma u naletu", description: `${lastFiveWins} pobjeda u zadnjih 5 završenih mečeva.`, tone: "green" });
  addAuto((profileStats.lastFive || []).length >= 5 && lastFiveWins === 5, { emoji: "🚀", title: "Serija bez kočnica", description: "Pet pobjeda u zadnjih pet završenih mečeva.", tone: "red" });
  addAuto(avgPoints >= 140, { emoji: "🧮", title: "Bod mašina", description: `Prosječno oko ${avgPoints} bodova po završenom meču.`, tone: "blue" });
  addAuto(profileStats.totalPoints >= 1000, { emoji: "🧨", title: "Napadačka ekipa", description: `Ukupno su skupili ${profileStats.totalPoints} bodova.`, tone: "red" });
  addAuto(positiveHeadToHead >= 2, { emoji: "🔒", title: "Stabilna ekipa", description: `Imaju pozitivan međusobni omjer protiv ${positiveHeadToHead} ekipa.`, tone: "blue" });
  addAuto(Boolean(unbeatenRival), { emoji: "🧊", title: "Noćna mora protivnika", description: unbeatenRival ? `${unbeatenRival.wins}-0 protiv ekipe ${unbeatenRival.opponentName}.` : "Dominantan međusobni omjer.", tone: "red" });
  addAuto(Boolean(dominantRival), { emoji: "🪓", title: "Dominator", description: dominantRival ? `Protiv ${dominantRival.opponentName} imaju prosječnu razliku +${dominantRival.averageDiff}.` : "Dominantni međusobni susreti.", tone: "purple" });

  return achievements;
}

function calculateHeadToHeadStats(teamId: string, matches: any[], teamById: Map<string, any>): HeadToHeadRow[] {
  const grouped = new Map<string, HeadToHeadRow>();
  const finishedMatches = matches
    .filter((match) => match.status === "finished" && match.winner_id)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  for (const match of finishedMatches) {
    const isTeamA = match.team_a_id === teamId;
    const opponentId = isTeamA ? match.team_b_id : match.team_a_id;
    if (!opponentId) continue;

    const opponent = teamById.get(opponentId);
    const opponentName = opponent?.name || opponent?.team_name || (isTeamA ? match.team_b_name : match.team_a_name) || "Nepoznat protivnik";
    const scoreFor = getScore(match, isTeamA ? "a" : "b");
    const scoreAgainst = getScore(match, isTeamA ? "b" : "a");
    const won = match.winner_id === teamId;

    const current = grouped.get(opponentId) || {
      opponentId,
      opponentName,
      opponentCity: opponent?.city,
      totalMatches: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      averageDiff: 0,
      lastMatch: match,
      lastResult: won ? "Pobjeda" : "Poraz",
    };

    current.totalMatches += 1;
    current.wins += won ? 1 : 0;
    current.losses += won ? 0 : 1;
    current.pointsFor += Number(scoreFor || 0);
    current.pointsAgainst += Number(scoreAgainst || 0);
    current.averageDiff = Math.round((current.pointsFor - current.pointsAgainst) / current.totalMatches);

    if (!current.lastMatch || new Date(match.created_at || 0).getTime() > new Date(current.lastMatch.created_at || 0).getTime()) {
      current.lastMatch = match;
      current.lastResult = won ? "Pobjeda" : "Poraz";
    }

    grouped.set(opponentId, current);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.totalMatches !== a.totalMatches) return b.totalMatches - a.totalMatches;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.opponentName.localeCompare(b.opponentName);
  });
}

function calculateBestSingleGameDeclarations(teamId: string, matches: any[], games: any[]) {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  let best = 0;

  for (const game of games) {
    const match = matchById.get(game.match_id);
    if (!match) continue;

    if (match.team_a_id === teamId) {
      best = Math.max(best, Number(game.team_a_declarations || 0));
    }

    if (match.team_b_id === teamId) {
      best = Math.max(best, Number(game.team_b_declarations || 0));
    }
  }

  return best;
}

function calculateChessElo(teamId: string, finishedMatches: any[]) {
  const eloMap = new Map<string, number>();

  const sortedMatches = [...finishedMatches].sort((a, b) => {
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  for (const match of sortedMatches) {
    const teamAId = match.team_a_id;
    const teamBId = match.team_b_id;

    if (!teamAId || !teamBId || !match.winner_id) continue;

    const eloA = eloMap.get(teamAId) || 1000;
    const eloB = eloMap.get(teamBId) || 1000;
    const resultA = match.winner_id === teamAId ? 1 : 0;
    const resultB = match.winner_id === teamBId ? 1 : 0;
    const changeA = Math.round(32 * (resultA - expectedScore(eloA, eloB)));
    const changeB = Math.round(32 * (resultB - expectedScore(eloB, eloA)));

    eloMap.set(teamAId, Math.max(100, eloA + changeA));
    eloMap.set(teamBId, Math.max(100, eloB + changeB));
  }

  return Math.round(eloMap.get(teamId) || 1000);
}

function expectedScore(teamElo: number, opponentElo: number) {
  return 1 / (1 + Math.pow(10, (opponentElo - teamElo) / 400));
}

function getScore(match: any, side: "a" | "b") {
  if (side === "a") {
    return match.team_a_score ?? match.score_a ?? match.points_a ?? match.result_a ?? 0;
  }

  return match.team_b_score ?? match.score_b ?? match.points_b ?? match.result_b ?? 0;
}

function ProfileStat({ title, value, sub }: { title: string; value: any; sub: string }) {
  return (
    <div className="rounded-3xl border border-[#d4b06a]/20 bg-[#0a2018] p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-2 text-3xl font-black text-[#f3dfad]">{value ?? 0}</p>
      <p className="mt-1 text-sm text-zinc-500">{sub}</p>
    </div>
  );
}

function TeamInfo({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <span className="text-sm font-bold text-[#d4b06a]">{label}</span>
      <span className="text-right text-sm text-zinc-200">{value || "-"}</span>
    </div>
  );
}

function HeadToHeadCard({ row }: { row: HeadToHeadRow }) {
  const winrate = row.totalMatches > 0 ? Math.round((row.wins / row.totalMatches) * 100) : 0;
  const positiveDiff = row.averageDiff > 0;
  const lastScoreFor = row.lastMatch
    ? getScore(row.lastMatch, row.lastMatch.team_a_id === row.opponentId ? "b" : "a")
    : 0;
  const lastScoreAgainst = row.lastMatch
    ? getScore(row.lastMatch, row.lastMatch.team_a_id === row.opponentId ? "a" : "b")
    : 0;

  return (
    <div className="rounded-3xl border border-[#d4b06a]/15 bg-[#0a2018] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <a href={`/ekipa/${row.opponentId}`} className="text-xl font-black text-[#f3dfad] hover:text-[#d4b06a]">
            {row.opponentName}
          </a>
          <p className="mt-1 text-sm text-zinc-500">{row.opponentCity || "Bez grada"}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${row.wins >= row.losses ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {row.wins}-{row.losses}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Susreti" value={row.totalMatches} />
        <MiniStat label="Winrate" value={`${winrate}%`} />
        <MiniStat label="Bodovi" value={`${row.pointsFor}:${row.pointsAgainst}`} />
        <MiniStat label="Prosjek" value={`${positiveDiff ? "+" : ""}${row.averageDiff}`} />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
        Zadnji susret: <span className="font-bold text-[#f3dfad]">{row.lastResult}</span>
        {row.lastMatch && <span className="text-zinc-500"> • {lastScoreFor}:{lastScoreAgainst}</span>}
      </div>
    </div>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const toneClass = {
    gold: "border-[#d4b06a]/30 bg-[#d4b06a]/10 text-[#f3dfad]",
    green: "border-green-500/30 bg-green-500/10 text-green-300",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    red: "border-red-500/30 bg-red-500/10 text-red-300",
  }[achievement.tone];

  return (
    <div className={`rounded-3xl border p-5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-4xl">{achievement.emoji}</div>
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] opacity-80">
          {achievement.source === "admin" ? "Admin" : "Auto"}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-black">{achievement.title}</h3>
      <p className="mt-2 text-sm opacity-80">{achievement.description}</p>
      {achievement.note && <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs opacity-90">Napomena: {achievement.note}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-black text-[#f3dfad]">{value}</p>
    </div>
  );
}

function MatchRow({ match, teamId, tournament, opponent }: { match: any; teamId: string; tournament?: any; opponent?: any }) {
  const isTeamA = match.team_a_id === teamId;
  const opponentId = isTeamA ? match.team_b_id : match.team_a_id;
  const opponentName = opponent?.name || opponent?.team_name || (isTeamA ? match.team_b_name : match.team_a_name);
  const scoreFor = getScore(match, isTeamA ? "a" : "b");
  const scoreAgainst = getScore(match, isTeamA ? "b" : "a");
  const isFinished = match.status === "finished";
  const won = isFinished && match.winner_id === teamId;

  return (
    <div className="rounded-3xl border border-[#d4b06a]/15 bg-[#184332]/70 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-black text-[#f3dfad]">
            vs {opponentId ? <a href={`/ekipa/${opponentId}`} className="hover:text-[#d4b06a]">{opponentName || "Nepoznat protivnik"}</a> : opponentName || "Nepoznat protivnik"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {tournament?.name || "Turnir"} {match.group_name ? `• Grupa ${match.group_name}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full border px-4 py-2 text-sm font-bold ${won ? "border-green-500/30 bg-green-500/10 text-green-300" : isFinished ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-[#d4b06a]/20 bg-[#d4b06a]/10 text-[#d4b06a]"}`}>
            {isFinished ? (won ? "Pobjeda" : "Poraz") : match.status || "Čeka se"}
          </span>
          <span className="rounded-full border border-[#d4b06a]/20 bg-[#d4b06a]/10 px-4 py-2 text-sm font-black text-[#d4b06a]">
            {scoreFor} : {scoreAgainst}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <a href={`/live/${match.id}`} className="btn-outline">Live</a>
        {!isFinished && <a href={`/mec/${match.id}`} className="btn-primary">Upiši rezultat</a>}
      </div>
    </div>
  );
}
