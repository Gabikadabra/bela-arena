"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tone = "gold" | "green" | "blue" | "purple" | "red";

type AchievementTemplate = {
  key: string;
  emoji: string;
  title: string;
  description: string;
  tone: Tone;
  category: string;
};

const MANUAL_ACHIEVEMENTS: AchievementTemplate[] = [
  { key: "bela_arena_legend", emoji: "👑", title: "Legenda Bele Arene", description: "Najveća posebna titula za ekipu koja je obilježila Bela Arenu i ostavila trag kroz turnire.", tone: "gold", category: "Prestiž" },
  { key: "fair_play", emoji: "🤝", title: "Fair Play ekipa", description: "Za ekipu koja igra pošteno, ne stvara probleme i poštuje protivnike.", tone: "green", category: "Ponašanje" },
  { key: "best_duo", emoji: "🧬", title: "Najbolji dvojac", description: "Za par koji izgleda kao da igra zajedno sto godina.", tone: "purple", category: "Igra" },
  { key: "tournament_hero", emoji: "🦸", title: "Heroji turnira", description: "Za ekipu koja je izvukla nemoguće ili spasila turnirsku atmosferu.", tone: "blue", category: "Turnir" },
  { key: "crowd_favorite", emoji: "📣", title: "Miljenici publike", description: "Ekipa koju publika najviše prati, komentira i bodri.", tone: "gold", category: "Publika" },
  { key: "comeback_kings_manual", emoji: "🔁", title: "Kraljevi comebacka", description: "Ručna titula za najluđi povratak dok ne postoji detaljan unos tijeka partije.", tone: "red", category: "Drama" },
  { key: "captain_of_the_night", emoji: "🧢", title: "Kapetan večeri", description: "Za igrača/ekipu koja vodi igru, ritam i komunikaciju.", tone: "blue", category: "Vodstvo" },
  { key: "clutch_team", emoji: "⏱️", title: "Clutch ekipa", description: "Za ekipu koja najbolje odigra kad je najnapetije.", tone: "red", category: "Drama" },
  { key: "showtime_team", emoji: "🎭", title: "Showtime ekipa", description: "Za ekipu koja od svakog meča napravi predstavu.", tone: "purple", category: "Atmosfera" },
  { key: "silent_killers", emoji: "🥷", title: "Tihi ubojice", description: "Za mirnu ekipu koja ne priča puno, ali stalno pobjeđuje.", tone: "blue", category: "Stil" },
  { key: "table_bosses", emoji: "🪑", title: "Gazde stola", description: "Za ekipu koja djeluje kao da je taj stol njihov teren.", tone: "gold", category: "Dominacija" },
  { key: "respect_team", emoji: "🫡", title: "Ekipa za respekt", description: "Za ekipu koju svi poštuju bez obzira na rezultat.", tone: "green", category: "Ponašanje" },
  { key: "underdog_story", emoji: "🐺", title: "Underdog priča", description: "Za ekipu koja nije bila favorit, ali je napravila veliki rezultat.", tone: "red", category: "Drama" },
  { key: "golden_pair", emoji: "🥇", title: "Zlatni par", description: "Za posebno dobru kombinaciju igrača.", tone: "gold", category: "Igra" },
  { key: "iron_mentality", emoji: "🧠", title: "Čelična glava", description: "Za ekipu koja se ne raspada pod pritiskom.", tone: "blue", category: "Mentalitet" },
  { key: "arena_icon", emoji: "🏟️", title: "Ikone arene", description: "Za ekipu koja je postala prepoznatljiv dio turnira.", tone: "purple", category: "Prestiž" },
  { key: "most_fun_team", emoji: "😂", title: "Najzabavnija ekipa", description: "Za ekipu s najboljom atmosferom, forama i energijom.", tone: "green", category: "Atmosfera" },
  { key: "ice_in_veins", emoji: "🧊", title: "Led u venama", description: "Za hladnokrvne završnice i mirnu ruku.", tone: "blue", category: "Drama" },
  { key: "card_wizards", emoji: "🪄", title: "Majstori karata", description: "Za ekipu koja je jednostavno imala poteze za pamćenje.", tone: "purple", category: "Igra" },
  { key: "honorary_champions", emoji: "🏅", title: "Počasni prvaci", description: "Titula koju admin dodjeljuje za poseban doprinos, čak i bez prvog mjesta.", tone: "gold", category: "Prestiž" },
  { key: "never_give_up", emoji: "💪", title: "Nema predaje", description: "Za ekipu koja se borila do zadnje karte.", tone: "red", category: "Mentalitet" },
  { key: "clean_game", emoji: "🧼", title: "Čista igra", description: "Za ekipu bez rasprava, natezanja i problema.", tone: "green", category: "Ponašanje" },
  { key: "big_match_team", emoji: "🌟", title: "Ekipa za velike mečeve", description: "Za ekipu koja se posebno digne u velikim utakmicama.", tone: "purple", category: "Turnir" },
  { key: "organizer_pick", emoji: "✅", title: "Izbor organizatora", description: "Posebna admin medalja za ekipu koju organizator želi istaknuti.", tone: "blue", category: "Admin" },
  { key: "hall_of_fame", emoji: "🏛️", title: "Hall of Fame", description: "Trajna elitna titula za ekipe koje ulaze u povijest Bele Arene.", tone: "gold", category: "Prestiž" },
];

const AUTOMATIC_ACHIEVEMENTS = [
  "🏆 Prva pobjeda",
  "🔥 Neporaženi",
  "♟️ ELO majstor",
  "💎 Elitni ELO",
  "👑 Kraljevi zvanja",
  "💥 Zvanje bomba",
  "🧱 Stalni sudionici",
  "🎖️ Iskusna ekipa",
  "🛡️ Veterani arene",
  "🏟️ Legende sezone",
  "🎯 Precizni završivači",
  "⚡ Forma u naletu",
  "🚀 Serija bez kočnica",
  "🧊 Noćna mora protivnika",
  "🪓 Dominatori",
  "🧮 Bod mašina",
  "📈 ELO uspon",
  "🌪️ Opasna forma",
  "🔒 Stabilna ekipa",
  "🧨 Napadačka ekipa",
  "🪙 Prvi meč",
  "📚 Turnirsko iskustvo",
  "🥉 Pozitivan omjer",
  "🥈 Jaka pobjednička stopa",
  "🥇 Elitna pobjednička stopa",
];

export default function AdminAchievementiPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [awards, setAwards] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedAchievementKey, setSelectedAchievementKey] = useState(MANUAL_ACHIEVEMENTS[0].key);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  function loginAdmin(e: React.FormEvent) {
    e.preventDefault();

    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      sessionStorage.setItem("bela_admin", "true");
      setIsAdmin(true);
    } else {
      alert("Kriva lozinka.");
    }
  }

  function logoutAdmin() {
    sessionStorage.removeItem("bela_admin");
    setIsAdmin(false);
  }

  async function loadData() {
    setLoading(true);

    const { data: teamData } = await supabase
      .from("teams")
      .select("id,name,team_name,city,player_one,player_two,captain_name,status,created_at")
      .order("created_at", { ascending: false });

    const safeTeams = teamData || [];
    setTeams(safeTeams);

    if (!selectedTeamId && safeTeams.length > 0) {
      setSelectedTeamId(safeTeams[0].id);
    }

    const { data: awardData } = await supabase
      .from("team_manual_achievements")
      .select("*")
      .order("created_at", { ascending: false });

    setAwards(awardData || []);
    setLoading(false);
  }

  async function awardAchievement(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const template = MANUAL_ACHIEVEMENTS.find((item) => item.key === selectedAchievementKey);
    if (!selectedTeamId || !template) return;

    const { error } = await supabase
      .from("team_manual_achievements")
      .upsert(
        {
          team_id: selectedTeamId,
          achievement_key: template.key,
          emoji: template.emoji,
          title: template.title,
          description: template.description,
          tone: template.tone,
          note: note.trim() || null,
          awarded_by: "admin",
        },
        { onConflict: "team_id,achievement_key" }
      );

    if (error) {
      setMessage(`Greška: ${error.message}`);
      return;
    }

    setNote("");
    setMessage("Medalja je dodijeljena ekipi.");
    await loadData();
  }

  async function removeAward(id: string) {
    const { error } = await supabase
      .from("team_manual_achievements")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(`Greška: ${error.message}`);
      return;
    }

    setMessage("Medalja je maknuta s ekipe.");
    await loadData();
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("bela_admin");

    if (saved === "true") {
      setIsAdmin(true);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    loadData();

    const channel = supabase
      .channel("admin-achievementi-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "team_manual_achievements" }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const filteredTeams = useMemo(() => {
    const search = teamSearch.trim().toLowerCase();
    if (!search) return teams;
    return teams.filter((team) => {
      const haystack = [team.name, team.team_name, team.city, team.player_one, team.player_two, team.captain_name, team.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [teams, teamSearch]);
  const selectedTemplate = MANUAL_ACHIEVEMENTS.find((item) => item.key === selectedAchievementKey) || MANUAL_ACHIEVEMENTS[0];

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <div className="card shadow-2xl">
          <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
            Admin pristup
          </p>

          <h1 className="text-4xl font-black text-[#f3dfad]">Achievementi</h1>

          <form onSubmit={loginAdmin} className="mt-8 space-y-4">
            <input
              type="password"
              placeholder="Admin lozinka"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />

            <button className="rounded-xl bg-[#d4b06a] px-8 py-4 font-black text-black transition hover:bg-[#f3dfad]">
              Uđi u admin
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
            Admin medalje
          </p>
          <h1 className="text-4xl font-black text-[#f3dfad] sm:text-5xl">Achievement centar</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Automatske medalje app računa sama iz rezultata, ELO-a, mečeva i zvanja, a posebne titule ovdje ručno dodjeljuješ ekipama iz Supabase liste.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a href="/admin" className="btn-outline">Admin panel</a>
          <button onClick={logoutAdmin} className="btn-danger">Odjava</button>
        </div>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="card-soft">
          <p className="text-sm text-zinc-400">Ukupno achievementa</p>
          <p className="mt-2 text-4xl font-black text-[#f3dfad]">50</p>
          <p className="mt-1 text-sm text-zinc-500">25 automatskih + 25 admin titula</p>
        </div>
        <div className="card-soft">
          <p className="text-sm text-zinc-400">Ručno dodijeljeno</p>
          <p className="mt-2 text-4xl font-black text-[#f3dfad]">{awards.length}</p>
          <p className="mt-1 text-sm text-zinc-500">posebne medalje na profilima ekipa</p>
        </div>
        <div className="card-soft">
          <p className="text-sm text-zinc-400">Ekipe</p>
          <p className="mt-2 text-4xl font-black text-[#f3dfad]">{teams.length}</p>
          <p className="mt-1 text-sm text-zinc-500">dostupne za dodjelu</p>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="card">
          <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Dodijeli posebnu medalju</h2>
          <p className="mt-2 text-zinc-400">Ovo je za titule koje app ne može sama fer izračunati.</p>

          <form onSubmit={awardAchievement} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-[#d4b06a]">Ekipa</label>
              <input
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="input mb-3"
                placeholder="Pretraži ekipu, igrača, grad ili status..."
              />
              <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="input" required>
                {filteredTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name || team.team_name || "Ekipa bez imena"} {team.city ? `— ${team.city}` : ""} {team.player_one || team.player_two ? `(${[team.player_one, team.player_two].filter(Boolean).join(" / ")})` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-zinc-500">
                Učitava direktno sve ekipe iz Supabase tablice <b>teams</b>. Prikazano: {filteredTeams.length}/{teams.length}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[#d4b06a]">Medalja</label>
              <select value={selectedAchievementKey} onChange={(e) => setSelectedAchievementKey(e.target.value)} className="input" required>
                {MANUAL_ACHIEVEMENTS.map((achievement) => (
                  <option key={achievement.key} value={achievement.key}>
                    {achievement.emoji} {achievement.title} — {achievement.category}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-3xl border border-[#d4b06a]/20 bg-[#0a2018] p-5">
              <div className="text-5xl">{selectedTemplate.emoji}</div>
              <h3 className="mt-4 text-2xl font-black text-[#f3dfad]">{selectedTemplate.title}</h3>
              <p className="mt-2 text-zinc-400">{selectedTemplate.description}</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[#d4b06a]">Napomena admina</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input min-h-28"
                placeholder="Npr. osvojili publiku u finalu, fair play potez, najveći preokret večeri..."
              />
            </div>

            <button className="btn-primary w-full justify-center">Dodijeli medalju</button>
          </form>

          {message && (
            <div className="mt-5 rounded-2xl border border-[#d4b06a]/20 bg-[#d4b06a]/10 p-4 font-bold text-[#f3dfad]">
              {message}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Achievementi</h2>
          <p className="mt-2 text-zinc-400">Doktorski sistem: 25 automatskih medalja računa aplikacija, a 25 posebnih titula dodjeljuje admin.</p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-5">
              <h3 className="text-xl font-black text-green-300">Automatski</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-300">
                {AUTOMATIC_ACHIEVEMENTS.map((item) => <p key={item}>{item}</p>)}
              </div>
            </div>

            <div className="rounded-3xl border border-[#d4b06a]/20 bg-[#d4b06a]/10 p-5">
              <h3 className="text-xl font-black text-[#f3dfad]">Admin titule</h3>
              <div className="mt-4 space-y-2 text-sm text-zinc-300">
                {MANUAL_ACHIEVEMENTS.map((item) => <p key={item.key}>{item.emoji} {item.title}</p>)}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-8 card">
        <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Dodijeljene admin medalje</h2>
        <p className="mt-2 text-zinc-400">Ovdje možeš maknuti medalju ako si je krivo dodijelio.</p>

        <div className="mt-6 space-y-4">
          {loading && <p className="text-zinc-300">Učitavam...</p>}
          {!loading && awards.length === 0 && <div className="card-soft text-zinc-300">Još nema ručno dodijeljenih medalja.</div>}

          {awards.map((award) => {
            const team = teamById.get(award.team_id);
            return (
              <div key={award.id} className="rounded-3xl border border-[#d4b06a]/15 bg-[#12392b] p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <p className="text-sm text-zinc-500">{team?.name || team?.team_name || "Nepoznata ekipa"}</p>
                    <h3 className="mt-1 text-2xl font-black text-[#f3dfad]">{award.emoji} {award.title}</h3>
                    <p className="mt-1 text-zinc-400">{award.note || award.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {team?.id && <a href={`/ekipa/${team.id}`} className="btn-outline">Profil</a>}
                    <button onClick={() => removeAward(award.id)} className="btn-danger">Makni</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
