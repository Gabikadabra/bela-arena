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
  {
    key: "bela_arena_legend",
    emoji: "👑",
    title: "Legenda Bele Arene",
    description: "Posebna titula za ekipu koja je obilježila turnire i ostavila trag u zajednici.",
    tone: "gold",
    category: "Prestiž",
  },
  {
    key: "fair_play",
    emoji: "🤝",
    title: "Fair Play ekipa",
    description: "Za ekipu poznatu po poštenoj igri, normalnom ponašanju i sportskom duhu.",
    tone: "green",
    category: "Ponašanje",
  },
  {
    key: "best_duo",
    emoji: "🧬",
    title: "Najbolji dvojac",
    description: "Za ekipu koja najbolje djeluje kao pravi par za belu.",
    tone: "purple",
    category: "Igra",
  },
  {
    key: "tournament_hero",
    emoji: "🦸",
    title: "Heroji turnira",
    description: "Za ekipu koja je izvukla nemoguće ili nosila atmosferu turnira.",
    tone: "blue",
    category: "Turnir",
  },
  {
    key: "crowd_favorite",
    emoji: "📣",
    title: "Miljenici publike",
    description: "Ekipa koju je publika najviše pratila, komentirala ili bodrila.",
    tone: "gold",
    category: "Publika",
  },
  {
    key: "comeback_kings_manual",
    emoji: "🔁",
    title: "Kraljevi comebacka",
    description: "Ručna titula za najveći povratak dok se ne uvede detaljno praćenje dijeljenja.",
    tone: "red",
    category: "Drama",
  },
  {
    key: "captain_of_the_night",
    emoji: "🧢",
    title: "Kapetan večeri",
    description: "Za vođu ekipe koji je držao igru, ritam i atmosferu.",
    tone: "blue",
    category: "Vodstvo",
  },
  {
    key: "clutch_team",
    emoji: "⏱️",
    title: "Clutch ekipa",
    description: "Za ekipu koja najbolje odigra kada je najnapetije.",
    tone: "red",
    category: "Drama",
  },
];

const AUTOMATIC_ACHIEVEMENTS = [
  "🏆 Prva pobjeda",
  "🔥 Neporaženi",
  "♟️ ELO majstor",
  "💎 Elitni ELO",
  "👑 Kraljevi zvanja",
  "🧱 Stalni sudionici",
  "🎖️ Iskusna ekipa",
  "🛡️ Veterani arene",
  "🎯 Precizni završivači",
  "⚡ Forma u naletu",
  "🚀 Serija bez kočnica",
  "🧊 Noćna mora protivnika",
];

export default function AdminAchievementiPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
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
            Automatske medalje app računa sama, a posebne titule ovdje ručno dodjeljuješ ekipama.
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
          <p className="mt-2 text-4xl font-black text-[#f3dfad]">20</p>
          <p className="mt-1 text-sm text-zinc-500">12 automatskih + 8 admin titula</p>
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
              <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="input" required>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name || team.team_name || "Ekipa bez imena"} {team.city ? `— ${team.city}` : ""}
                  </option>
                ))}
              </select>
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
          <p className="mt-2 text-zinc-400">Doktorski sistem: ono što se može izračunati ide automatski, ostalo dodaje admin.</p>

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
