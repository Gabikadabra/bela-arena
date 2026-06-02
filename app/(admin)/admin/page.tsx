"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { syncTournamentAfterResult } from "@/lib/tournamentProgress";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");

  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminTeamForm, setAdminTeamForm] = useState({
    name: "",
    city: "",
    captainName: "",
    playerOne: "",
    playerTwo: "",
    phone: "",
    email: "",
    partnerEmail: "",
  });
  const [manualScores, setManualScores] = useState<
    Record<
      string,
      { scoreA: string; scoreB: string; mackiWinner?: "A" | "B" | "" }
    >
  >({});
  const [activeSection, setActiveSection] = useState<
    "pregled" | "prijave" | "dodaj" | "manual"
  >("pregled");
  const [selectedManualMatchId, setSelectedManualMatchId] = useState("");

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

  async function loadTournaments() {
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .order("starts_at", { ascending: true });

    const activeTournaments = (data || []).filter(
      (tournament) => tournament.status !== "finished",
    );

    setTournaments(activeTournaments);

    if (activeTournaments.length === 0) {
      setSelectedTournament("");
      setTeams([]);
      setMatches([]);
      setManualScores({});
      setLoading(false);
      return;
    }

    setSelectedTournament((current) =>
      current && activeTournaments.some((t) => t.id === current)
        ? current
        : activeTournaments[0]?.id || "",
    );
  }

  async function loadTeams(tournamentId: string) {
    setLoading(true);

    const { data } = await supabase
      .from("teams")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false });

    setTeams(data || []);
    setLoading(false);
  }

  async function loadMatches(tournamentId: string) {
    const { data } = await supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("phase", { ascending: true })
      .order("round", { ascending: true })
      .order("match_number", { ascending: true });

    const rows = data || [];
    setMatches(rows);
    setManualScores((current) => {
      const next = { ...current };
      for (const match of rows) {
        if (!next[match.id]) {
          next[match.id] = {
            scoreA: String(match.score_a ?? 0),
            scoreB: String(match.score_b ?? 0),
            mackiWinner: "",
          };
        }
      }
      return next;
    });
  }

  function updateManualScore(matchId: string, team: "A" | "B", value: string) {
    const cleanValue = value.replace(/\D/g, "");

    setManualScores((current) => ({
      ...current,
      [matchId]: {
        ...(current[matchId] || { scoreA: "0", scoreB: "0", mackiWinner: "" }),
        scoreA: team === "A" ? cleanValue : current[matchId]?.scoreA || "0",
        scoreB: team === "B" ? cleanValue : current[matchId]?.scoreB || "0",
        mackiWinner: "",
      },
    }));
  }

  function setManualMacki(matchId: string, winner: "A" | "B") {
    setManualScores((current) => ({
      ...current,
      [matchId]: {
        scoreA: winner === "A" ? "162" : "0",
        scoreB: winner === "B" ? "162" : "0",
        mackiWinner: winner,
      },
    }));
  }

  async function addTeamByAdmin(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedTournament) {
      alert("Odaberi turnir.");
      return;
    }

    const { error } = await supabase.from("teams").insert({
      tournament_id: selectedTournament,
      name: adminTeamForm.name.trim(),
      city: adminTeamForm.city.trim() || null,
      captain_name:
        adminTeamForm.captainName.trim() || adminTeamForm.playerOne.trim(),
      captain_user_id: null,
      player_one: adminTeamForm.playerOne.trim(),
      player_two: adminTeamForm.playerTwo.trim(),
      partner_email: adminTeamForm.partnerEmail.trim() || null,
      partner_user_id: null,
      invite_status: adminTeamForm.partnerEmail.trim()
        ? "pending"
        : "not_required",
      phone: adminTeamForm.phone.trim() || null,
      email: adminTeamForm.email.trim() || null,
      status: "approved",
      created_by_admin: true,
    });

    if (error) {
      alert("Greška kod dodavanja ekipe: " + error.message);
      return;
    }

    setAdminTeamForm({
      name: "",
      city: "",
      captainName: "",
      playerOne: "",
      playerTwo: "",
      phone: "",
      email: "",
      partnerEmail: "",
    });
    await loadTeams(selectedTournament);
  }

  async function saveManualResult(match: any) {
    const values = manualScores[match.id] || {
      scoreA: "0",
      scoreB: "0",
      mackiWinner: "",
    };
    const hasMackiA = values.mackiWinner === "A";
    const hasMackiB = values.mackiWinner === "B";
    const scoreA = hasMackiA ? 162 : hasMackiB ? 0 : Number(values.scoreA);
    const scoreB = hasMackiB ? 162 : hasMackiA ? 0 : Number(values.scoreB);

    if (!match.team_a_id || !match.team_b_id) {
      alert("Meč nema obje ekipe.");
      return;
    }

    if (
      !Number.isFinite(scoreA) ||
      !Number.isFinite(scoreB) ||
      scoreA < 0 ||
      scoreB < 0
    ) {
      alert("Upiši ispravan rezultat.");
      return;
    }

    if (scoreA === scoreB) {
      alert("Rezultat ne može biti neriješen.");
      return;
    }

    const winnerId = scoreA > scoreB ? match.team_a_id : match.team_b_id;

    const { error } = await supabase
      .from("matches")
      .update({
        score_a: scoreA,
        score_b: scoreB,
        sets_a: scoreA > scoreB ? 1 : 0,
        sets_b: scoreB > scoreA ? 1 : 0,
        winner_id: winnerId,
        status: "finished",
        result_status: hasMackiA || hasMackiB ? "macki" : "manual",
        finished_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    if (error) {
      alert("Greška kod spremanja rezultata: " + error.message);
      return;
    }

    if (hasMackiA || hasMackiB) {
      const { error: gameError } = await supabase.from("match_games").insert({
        match_id: match.id,
        set_number: Number(match.current_set || 1),
        game_number: 1,
        caller_team: null,
        called_team_fell: false,
        raw_team_a_tricks: scoreA,
        raw_team_b_tricks: scoreB,
        team_a_tricks: scoreA,
        team_b_tricks: scoreB,
        team_a_declarations: hasMackiA ? 90 : 0,
        team_b_declarations: hasMackiB ? 90 : 0,
        team_a_bela: false,
        team_b_bela: false,
        team_a_macki: hasMackiA,
        team_b_macki: hasMackiB,
        team_a_total: scoreA + (hasMackiA ? 90 : 0),
        team_b_total: scoreB + (hasMackiB ? 90 : 0),
        note: "Mački - automatski manualni unos",
      });

      if (gameError) {
        alert(
          "Rezultat je spremljen, ali mački statistika nije: " +
            gameError.message,
        );
      }
    }

    await syncTournamentAfterResult({
      ...match,
      score_a: scoreA,
      score_b: scoreB,
      sets_a: scoreA > scoreB ? 1 : 0,
      sets_b: scoreB > scoreA ? 1 : 0,
      winner_id: winnerId,
      status: "finished",
    });

    await loadMatches(selectedTournament);
  }

  async function finishTournament() {
    if (!selectedTournament) return;

    const confirmed = confirm(
      "Jesi siguran da želiš označiti turnir kao završen?",
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("tournaments")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", selectedTournament);

    if (error) {
      alert("Greška kod završavanja turnira: " + error.message);
      return;
    }

    await loadTournaments();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("teams").update({ status }).eq("id", id);

    if (selectedTournament) {
      loadTeams(selectedTournament);
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("bela_admin");

    if (saved === "true") {
      setIsAdmin(true);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    loadTournaments();

    const channel = supabase
      .channel("admin-tournaments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => loadTournaments(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedTournament) {
      setTeams([]);
      setMatches([]);
      setLoading(false);
      return;
    }

    loadTeams(selectedTournament);
    loadMatches(selectedTournament);

    const channel = supabase
      .channel(`admin-teams-${selectedTournament}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `tournament_id=eq.${selectedTournament}`,
        },
        () => loadTeams(selectedTournament),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${selectedTournament}`,
        },
        () => {
          loadTeams(selectedTournament);
          loadMatches(selectedTournament);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTournament]);

  useEffect(() => {
    if (activeSection !== "manual") return;

    if (matches.length === 0) {
      setSelectedManualMatchId("");
      return;
    }

    if (!selectedManualMatchId || !matches.some((match) => match.id === selectedManualMatchId)) {
      setSelectedManualMatchId(matches[0].id);
    }
  }, [activeSection, matches, selectedManualMatchId]);

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <div className="card shadow-2xl">
          <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
            Admin pristup
          </p>

          <h1 className="text-4xl font-black text-[#f3dfad]">
            Unesi admin lozinku
          </h1>

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

  const selectedTournamentData = tournaments.find(
    (t) => t.id === selectedTournament,
  );

  const pendingTeams = teams.filter((team) => team.status === "pending");
  const approvedTeams = teams.filter((team) => team.status === "approved");
  const rejectedTeams = teams.filter((team) => team.status === "rejected");
  const finishedMatches = matches.filter((match) => match.status === "finished");
  const openMatches = matches.filter((match) => match.status !== "finished");
  const manualEnabled = Boolean(selectedTournamentData?.manual_score_entry);
  const selectedManualMatch =
    matches.find((match) => match.id === selectedManualMatchId) || matches[0];

  const adminSections = [
    { id: "pregled", label: "Pregled", count: tournaments.length },
    { id: "prijave", label: "Prijave", count: teams.length },
    { id: "dodaj", label: "Dodaj ekipu", count: null },
    { id: "manual", label: "Manual rezultati", count: manualEnabled ? openMatches.length : null },
  ] as const;

  const tournamentQuery = selectedTournament
    ? `?tournamentId=${encodeURIComponent(selectedTournament)}`
    : "";
  const editTournamentHref = selectedTournament
    ? `/admin/uredi-turnir/${selectedTournament}`
    : "/admin/uredi-turnir";
  const drawHref = selectedTournament
    ? `/admin/zdrijeb${tournamentQuery}`
    : "/admin/zdrijeb";
  const bracketHref = selectedTournament
    ? `/admin/bracket/${selectedTournament}`
    : "/admin";
  const dashboardHref = selectedTournament
    ? `/dashboard/${selectedTournament}`
    : "/admin";
  const publicTournamentHref = selectedTournament
    ? `/tournament/${selectedTournament}`
    : "/turniri";
  const achievementsHref = selectedTournament
    ? `/admin/achievementi${tournamentQuery}`
    : "/admin/achievementi";

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <div className="card shadow-2xl">
          <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
            Admin pristup
          </p>

          <h1 className="text-4xl font-black text-[#f3dfad]">
            Unesi admin lozinku
          </h1>

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
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
            Admin dashboard
          </p>

          <h1 className="text-4xl font-black text-[#f3dfad] sm:text-5xl">
            Kontrolni centar
          </h1>

          <p className="mt-3 max-w-2xl text-zinc-300">
            Sve bitno za turnir na jednom mjestu: prijave, ekipe, ždrijeb,
            manualni rezultati i završavanje turnira.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a href="/admin/novi-turnir" className="btn-primary">
            + Novi turnir
          </a>
          <button onClick={logoutAdmin} className="btn-danger">
            Odjava
          </button>
        </div>
      </div>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <label className="mb-2 block text-sm font-bold text-[#d4b06a]">
                Aktivni turnir
              </label>
              <select
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
                className="input"
              >
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name} — {tournament.location}
                  </option>
                ))}
                {tournaments.length === 0 && (
                  <option value="">Nema aktivnih turnira</option>
                )}
              </select>
            </div>

            {selectedTournamentData && (
              <button
                type="button"
                onClick={finishTournament}
                className="rounded-xl bg-red-600 px-5 py-3 font-black text-white transition hover:bg-red-500"
              >
                Turnir završen
              </button>
            )}
          </div>

          {!loading && tournaments.length === 0 && (
            <div className="mt-6 rounded-2xl border border-[#d4b06a]/15 bg-[#12392b] p-6 text-zinc-300">
              Nema aktivnih turnira za administraciju. Završene turnire možeš
              pregledati u povijesti.
            </div>
          )}

          {selectedTournamentData && (
            <div className="mt-6 rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <p className="text-sm text-zinc-400">Trenutno upravljaš</p>
                  <h2 className="mt-1 text-2xl font-black text-[#f3dfad]">
                    {selectedTournamentData.name}
                  </h2>
                  <p className="mt-1 text-zinc-400">
                    {selectedTournamentData.location} · {selectedTournamentData.starts_at}
                  </p>
                </div>

                <span
                  className={`w-fit rounded-full px-4 py-2 text-sm font-black ${
                    manualEnabled
                      ? "bg-green-500/15 text-green-300"
                      : "bg-zinc-500/15 text-zinc-300"
                  }`}
                >
                  Manual: {manualEnabled ? "uključen" : "isključen"}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-5">
            <p className="text-sm font-bold text-zinc-400">Ekipe</p>
            <p className="mt-1 text-3xl font-black text-[#d4b06a]">{teams.length}</p>
            <p className="text-sm text-zinc-500">{approvedTeams.length} potvrđeno</p>
          </div>
          <div className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-5">
            <p className="text-sm font-bold text-zinc-400">Na čekanju</p>
            <p className="mt-1 text-3xl font-black text-[#d4b06a]">{pendingTeams.length}</p>
            <p className="text-sm text-zinc-500">{rejectedTeams.length} odbijeno</p>
          </div>
          <div className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-5">
            <p className="text-sm font-bold text-zinc-400">Mečevi</p>
            <p className="mt-1 text-3xl font-black text-[#d4b06a]">{matches.length}</p>
            <p className="text-sm text-zinc-500">{finishedMatches.length} završeno</p>
          </div>
          <div className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-5">
            <p className="text-sm font-bold text-zinc-400">Otvoreno</p>
            <p className="mt-1 text-3xl font-black text-[#d4b06a]">{openMatches.length}</p>
            <p className="text-sm text-zinc-500">za upis rezultata</p>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <a href={editTournamentHref} className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-4 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10">
          <span className="block text-xl text-[#d4b06a]">✏️</span>
          Uredi turnir
        </a>
        <a href={drawHref} className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-4 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10">
          <span className="block text-xl text-[#d4b06a]">🎲</span>
          Ždrijeb
        </a>
        <a href={publicTournamentHref} className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-4 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10">
          <span className="block text-xl text-[#d4b06a]">🏆</span>
          Rezultati
        </a>
        <a href={dashboardHref} target={selectedTournament ? "_blank" : undefined} rel={selectedTournament ? "noopener noreferrer" : undefined} className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-4 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10">
          <span className="block text-xl text-[#d4b06a]">📺</span>
          TV dashboard
        </a>
        <a href={achievementsHref} className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-4 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10">
          <span className="block text-xl text-[#d4b06a]">🏅</span>
          Achievementi
        </a>
      </section>

      <div className="mb-6 overflow-x-auto rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-2">
        <div className="flex min-w-max gap-2">
          {adminSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                activeSection === section.id
                  ? "bg-[#d4b06a] text-black"
                  : "text-zinc-300 hover:bg-[#d4b06a]/10 hover:text-[#f3dfad]"
              }`}
            >
              {section.label}
              {section.count !== null && (
                <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-xs">
                  {section.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeSection === "pregled" && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="text-2xl font-black text-[#f3dfad]">Brzi pregled</h2>
            <p className="mt-2 text-zinc-400">
              Ovdje vidiš stanje aktivnog turnira bez skrolanja kroz sve prijave.
            </p>
            <div className="mt-6 space-y-3">
              <div className="flex justify-between rounded-xl bg-[#12392b] p-4">
                <span className="text-zinc-400">Potvrđene ekipe</span>
                <b className="text-[#d4b06a]">{approvedTeams.length}</b>
              </div>
              <div className="flex justify-between rounded-xl bg-[#12392b] p-4">
                <span className="text-zinc-400">Čekaju potvrdu</span>
                <b className="text-[#d4b06a]">{pendingTeams.length}</b>
              </div>
              <div className="flex justify-between rounded-xl bg-[#12392b] p-4">
                <span className="text-zinc-400">Završeni mečevi</span>
                <b className="text-[#d4b06a]">{finishedMatches.length}/{matches.length}</b>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-2xl font-black text-[#f3dfad]">Najčešće akcije</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setActiveSection("prijave")} className="rounded-xl bg-[#12392b] p-4 text-left font-bold text-[#f3dfad] transition hover:bg-[#d4b06a]/10">
                Potvrdi prijave
              </button>
              <button type="button" onClick={() => setActiveSection("dodaj")} className="rounded-xl bg-[#12392b] p-4 text-left font-bold text-[#f3dfad] transition hover:bg-[#d4b06a]/10">
                Dodaj ekipu
              </button>
              <button type="button" onClick={() => setActiveSection("manual")} className="rounded-xl bg-[#12392b] p-4 text-left font-bold text-[#f3dfad] transition hover:bg-[#d4b06a]/10">
                Upiši rezultat
              </button>
              <a href={bracketHref} className="rounded-xl bg-[#12392b] p-4 font-bold text-[#f3dfad] transition hover:bg-[#d4b06a]/10">
                Otvori bracket
              </a>
            </div>
          </div>
        </section>
      )}

      {activeSection === "dodaj" && (
        <section className="card">
          <h2 className="text-2xl font-black text-[#f3dfad]">Dodaj ekipu na dan turnira</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Ekipa koju admin doda odmah je potvrđena. Mail partnera nije obavezan.
          </p>

          <form onSubmit={addTeamByAdmin} className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <input className="input" required placeholder="Naziv ekipe" value={adminTeamForm.name} onChange={(e) => setAdminTeamForm({ ...adminTeamForm, name: e.target.value })} />
              <input className="input" placeholder="Grad" value={adminTeamForm.city} onChange={(e) => setAdminTeamForm({ ...adminTeamForm, city: e.target.value })} />
              <input className="input" required placeholder="Igrač 1" value={adminTeamForm.playerOne} onChange={(e) => setAdminTeamForm({ ...adminTeamForm, playerOne: e.target.value, captainName: adminTeamForm.captainName || e.target.value })} />
              <input className="input" required placeholder="Igrač 2" value={adminTeamForm.playerTwo} onChange={(e) => setAdminTeamForm({ ...adminTeamForm, playerTwo: e.target.value })} />
              <input className="input" placeholder="Kapetan / kontakt osoba" value={adminTeamForm.captainName} onChange={(e) => setAdminTeamForm({ ...adminTeamForm, captainName: e.target.value })} />
              <input className="input" placeholder="Mobitel" value={adminTeamForm.phone} onChange={(e) => setAdminTeamForm({ ...adminTeamForm, phone: e.target.value })} />
              <input className="input" type="email" placeholder="Email kapetana (nije obavezno)" value={adminTeamForm.email} onChange={(e) => setAdminTeamForm({ ...adminTeamForm, email: e.target.value })} />
              <input className="input" type="email" placeholder="Email partnera (nije obavezno)" value={adminTeamForm.partnerEmail} onChange={(e) => setAdminTeamForm({ ...adminTeamForm, partnerEmail: e.target.value })} />
            </div>

            <button type="submit" className="mt-5 rounded-xl bg-[#d4b06a] px-6 py-3 font-black text-black transition hover:bg-[#f3dfad]">
              Dodaj i potvrdi ekipu
            </button>
          </form>
        </section>
      )}

      {activeSection === "manual" && (
        <section className="card">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="text-2xl font-black text-[#f3dfad]">
                Manualni upis rezultata
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                Klikni meč, upiši rezultat i spremi. Admin unos je sada kao kod igrača,
                samo bez viška koraka.
              </p>
            </div>

            {selectedManualMatch && (
              <a
                href={`/mec/${selectedManualMatch.id}`}
                className="rounded-xl border border-[#d4b06a]/25 bg-[#d4b06a]/10 px-5 py-3 text-center font-black text-[#f3dfad] transition hover:bg-[#d4b06a]/20"
              >
                Otvori detaljni unos
              </a>
            )}
          </div>

          {!manualEnabled && (
            <div className="mt-6 rounded-2xl border border-[#d4b06a]/15 bg-[#12392b] p-6 text-zinc-300">
              Manualni upis nije uključen za ovaj turnir. Uredi turnir i uključi manualni upis rezultata.
            </div>
          )}

          {manualEnabled && matches.length === 0 && (
            <div className="mt-6 rounded-2xl border border-[#d4b06a]/15 bg-[#12392b] p-6 text-zinc-300">
              Nema generiranih mečeva za ovaj turnir.
            </div>
          )}

          {manualEnabled && matches.length > 0 && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-[#f3dfad]">Odaberi meč</h3>
                  <span className="rounded-full bg-[#12392b] px-3 py-1 text-xs font-black text-zinc-300">
                    {matches.length} mečeva
                  </span>
                </div>

                <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
                  {matches.map((match) => {
                    const isSelected = selectedManualMatch?.id === match.id;
                    const isFinished = match.status === "finished";

                    return (
                      <button
                        key={match.id}
                        type="button"
                        onClick={() => setSelectedManualMatchId(match.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                          isSelected
                            ? "border-[#d4b06a] bg-[#d4b06a]/15"
                            : "border-[#d4b06a]/10 bg-[#12392b] hover:border-[#d4b06a]/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-black text-[#f3dfad]">
                              {match.team_a_name || match.team_a_seed || "Ekipa A"}
                            </p>
                            <p className="text-center text-xs font-black text-[#d4b06a]">vs</p>
                            <p className="truncate font-black text-[#f3dfad]">
                              {match.team_b_name || match.team_b_seed || "Ekipa B"}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                              isFinished
                                ? "bg-green-500/15 text-green-300"
                                : "bg-[#d4b06a]/15 text-[#d4b06a]"
                            }`}
                          >
                            {isFinished ? "Završeno" : "Otvoreno"}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                          <span>Faza {match.phase || "-"}</span>
                          <span>·</span>
                          <span>Runda {match.round || "-"}</span>
                          <span>·</span>
                          <span>Meč {match.match_number || "-"}</span>
                        </div>

                        {(match.score_a !== null || match.score_b !== null) && (
                          <p className="mt-2 text-sm font-black text-[#d4b06a]">
                            {match.score_a ?? 0} : {match.score_b ?? 0}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedManualMatch && (
                <div className="rounded-3xl border border-[#d4b06a]/15 bg-[#0a2018] p-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-sm font-black text-[#d4b06a]">Upis za odabrani meč</p>
                      <h3 className="mt-2 text-2xl font-black text-[#f3dfad]">
                        {selectedManualMatch.team_a_name || selectedManualMatch.team_a_seed || "Ekipa A"}
                        <span className="mx-2 text-[#d4b06a]">vs</span>
                        {selectedManualMatch.team_b_name || selectedManualMatch.team_b_seed || "Ekipa B"}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        Faza {selectedManualMatch.phase || "-"} · Runda {selectedManualMatch.round || "-"} · status: {selectedManualMatch.status || "scheduled"}
                      </p>
                    </div>

                    <span className="w-fit rounded-full bg-[#12392b] px-4 py-2 text-sm font-black text-zinc-300">
                      {selectedManualMatch.status === "finished" ? "Možeš prepisati" : "Spremno za upis"}
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                    <label className="block rounded-2xl border border-[#d4b06a]/15 bg-[#12392b] p-4">
                      <span className="block text-center text-sm font-black text-[#d4b06a]">
                        {selectedManualMatch.team_a_name || "Ekipa A"}
                      </span>
                      <input
                        className="no-spinner mt-3 w-full rounded-2xl border border-[#d4b06a]/15 bg-[#06150f] px-4 py-5 text-center text-5xl font-black text-[#f3dfad] outline-none focus:border-[#d4b06a]"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="0"
                        value={manualScores[selectedManualMatch.id]?.scoreA ?? String(selectedManualMatch.score_a ?? 0)}
                        onChange={(e) => updateManualScore(selectedManualMatch.id, "A", e.target.value)}
                      />
                    </label>

                    <div className="hidden pb-8 text-4xl font-black text-[#d4b06a] sm:block">:</div>

                    <label className="block rounded-2xl border border-[#d4b06a]/15 bg-[#12392b] p-4">
                      <span className="block text-center text-sm font-black text-[#d4b06a]">
                        {selectedManualMatch.team_b_name || "Ekipa B"}
                      </span>
                      <input
                        className="no-spinner mt-3 w-full rounded-2xl border border-[#d4b06a]/15 bg-[#06150f] px-4 py-5 text-center text-5xl font-black text-[#f3dfad] outline-none focus:border-[#d4b06a]"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="0"
                        value={manualScores[selectedManualMatch.id]?.scoreB ?? String(selectedManualMatch.score_b ?? 0)}
                        onChange={(e) => updateManualScore(selectedManualMatch.id, "B", e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="mt-5 rounded-2xl border border-purple-400/20 bg-purple-500/10 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black text-purple-100">Mački</p>
                        <p className="text-sm text-purple-200/80">
                          Automatski postavlja 162 : 0 i dodaje +90 zvanja pobjedniku.
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setManualMacki(selectedManualMatch.id, "A")}
                          className={`rounded-xl border px-4 py-3 font-black transition ${
                            manualScores[selectedManualMatch.id]?.mackiWinner === "A"
                              ? "border-purple-100 bg-purple-300 text-black"
                              : "border-purple-300/25 bg-purple-500/10 text-purple-100"
                          }`}
                        >
                          Mački {selectedManualMatch.team_a_name || "A"}
                        </button>

                        <button
                          type="button"
                          onClick={() => setManualMacki(selectedManualMatch.id, "B")}
                          className={`rounded-xl border px-4 py-3 font-black transition ${
                            manualScores[selectedManualMatch.id]?.mackiWinner === "B"
                              ? "border-purple-100 bg-purple-300 text-black"
                              : "border-purple-300/25 bg-purple-500/10 text-purple-100"
                          }`}
                        >
                          Mački {selectedManualMatch.team_b_name || "B"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => saveManualResult(selectedManualMatch)}
                      className="rounded-2xl bg-green-500 px-5 py-4 text-lg font-black text-black transition hover:bg-green-400"
                    >
                      Spremi rezultat
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setManualScores({
                          ...manualScores,
                          [selectedManualMatch.id]: {
                            scoreA: String(selectedManualMatch.score_a ?? 0),
                            scoreB: String(selectedManualMatch.score_b ?? 0),
                            mackiWinner: "",
                          },
                        });
                      }}
                      className="rounded-2xl border border-[#d4b06a]/25 bg-[#d4b06a]/10 px-5 py-4 text-lg font-black text-[#f3dfad] transition hover:bg-[#d4b06a]/20"
                    >
                      Resetiraj unos
                    </button>
                  </div>

                  <p className="mt-4 text-center text-xs text-zinc-500">
                    Savjet: za običan rezultat samo upiši konačni rezultat. Za detaljan unos po dijeljenjima koristi “Otvori detaljni unos”.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {activeSection === "prijave" && (
        <section className="card">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="text-2xl font-black text-[#f3dfad]">Prijave ekipa</h2>
              <p className="mt-2 text-zinc-400">
                Potvrdi, odbij ili pregledaj ekipe za odabrani aktivni turnir.
              </p>
            </div>
            <button type="button" onClick={() => setActiveSection("dodaj")} className="rounded-xl bg-[#d4b06a] px-5 py-3 font-black text-black transition hover:bg-[#f3dfad]">
              + Dodaj ekipu
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {loading && <p>Učitavam...</p>}

            {!loading && teams.length === 0 && (
              <div className="rounded-2xl bg-[#12392b] p-6">
                Nema prijavljenih ekipa za ovaj turnir.
              </div>
            )}

            {teams.map((team) => (
              <div key={team.id} className="rounded-2xl border border-[#d4b06a]/15 bg-[#12392b] p-6">
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-[#d4b06a] sm:text-2xl">{team.name}</h3>
                    <p className="text-zinc-400">{team.city || "Bez grada"}</p>
                    <p className="text-zinc-400">Kapetan: {team.captain_name || "-"}</p>
                    <p className="text-zinc-400">Igrači: {team.player_one} / {team.player_two}</p>
                    {team.phone && <p className="text-zinc-400">Mobitel: {team.phone}</p>}
                    {team.email && <p className="text-zinc-400">Email: {team.email}</p>}
                  </div>

                  <div className="flex flex-col gap-3 md:min-w-36">
                    <span className={`rounded-full px-4 py-2 text-center font-bold ${team.status === "approved" ? "bg-green-500/20 text-green-300" : team.status === "rejected" ? "bg-red-500/20 text-red-300" : "bg-[#d4b06a]/20 text-[#d4b06a]"}`}>
                      {team.status}
                    </span>
                    <button onClick={() => updateStatus(team.id, "approved")} className="rounded-xl bg-green-500 px-5 py-2 font-bold text-black">
                      Potvrdi
                    </button>
                    <button onClick={() => updateStatus(team.id, "rejected")} className="rounded-xl bg-red-500 px-5 py-2 font-bold text-white">
                      Odbij
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
