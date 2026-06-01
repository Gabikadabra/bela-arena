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
    partnerEmail: ""
  });
  const [manualScores, setManualScores] = useState<Record<string, { scoreA: string; scoreB: string }>>({});

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

    setTournaments(data || []);

    if (data && data.length > 0) {
      setSelectedTournament((current) =>
        current && data.some((t) => t.id === current) ? current : data[0].id
      );
    }
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
            scoreB: String(match.score_b ?? 0)
          };
        }
      }
      return next;
    });
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
      captain_name: adminTeamForm.captainName.trim() || adminTeamForm.playerOne.trim(),
      captain_user_id: null,
      player_one: adminTeamForm.playerOne.trim(),
      player_two: adminTeamForm.playerTwo.trim(),
      partner_email: adminTeamForm.partnerEmail.trim() || null,
      partner_user_id: null,
      invite_status: adminTeamForm.partnerEmail.trim() ? "pending" : "not_required",
      phone: adminTeamForm.phone.trim() || null,
      email: adminTeamForm.email.trim() || null,
      status: "approved",
      created_by_admin: true
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
      partnerEmail: ""
    });
    await loadTeams(selectedTournament);
  }

  async function saveManualResult(match: any) {
    const values = manualScores[match.id] || { scoreA: "0", scoreB: "0" };
    const scoreA = Number(values.scoreA);
    const scoreB = Number(values.scoreB);

    if (!match.team_a_id || !match.team_b_id) {
      alert("Meč nema obje ekipe.");
      return;
    }

    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA < 0 || scoreB < 0) {
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
        result_status: "manual",
        finished_at: new Date().toISOString()
      })
      .eq("id", match.id);

    if (error) {
      alert("Greška kod spremanja rezultata: " + error.message);
      return;
    }

    await syncTournamentAfterResult({
      ...match,
      score_a: scoreA,
      score_b: scoreB,
      sets_a: scoreA > scoreB ? 1 : 0,
      sets_b: scoreB > scoreA ? 1 : 0,
      winner_id: winnerId,
      status: "finished"
    });

    await loadMatches(selectedTournament);
  }

  async function finishTournament() {
    if (!selectedTournament) return;

    const confirmed = confirm("Jesi siguran da želiš označiti turnir kao završen?");
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
        () => loadTournaments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedTournament) return;

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
          filter: `tournament_id=eq.${selectedTournament}`
        },
        () => loadTeams(selectedTournament)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${selectedTournament}`
        },
        () => {
          loadTeams(selectedTournament);
          loadMatches(selectedTournament);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTournament]);

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
    (t) => t.id === selectedTournament
  );

  return (
    <main className="page">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
            Admin dashboard
          </p>

          <h1 className="text-4xl font-black text-[#f3dfad] sm:text-5xl">Admin panel</h1>

          <p className="mt-3 max-w-2xl text-zinc-300">
            Upravljaj turnirima, prijavama, ždrijebom i rezultatima.
          </p>
        </div>

        <button
          onClick={logoutAdmin}
          className="btn-danger"
        >
          Odjava admina
        </button>
      </div>

      <div className="mb-10 grid gap-4 md:grid-cols-2 lg:grid-cols-10">
        <a
          href="/admin/novi-turnir"
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">+</span>
          Novi turnir
        </a>

        <a
          href="/admin/uredi-turnir"
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">✏️</span>
          Uredi turnir
        </a>

        <a
          href="/admin"
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">{teams.length}</span>
          Prijave
        </a>

        <a
          href="/admin/zdrijeb"
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">🎲</span>
          Ždrijeb
        </a>

        <a
          href={selectedTournament ? `/tournament/${selectedTournament}` : "/admin"}
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">🏆</span>
          Rezultati
        </a>

        <a
          href={
            selectedTournament
              ? `/admin/bracket/${selectedTournament}`
              : "/admin"
          }
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">🏁</span>
          Bracket
        </a>

        <a
          href={selectedTournament ? `/dashboard/${selectedTournament}` : "/admin"}
          target={selectedTournament ? "_blank" : undefined}
          rel={selectedTournament ? "noopener noreferrer" : undefined}
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">📺</span>
          TV dashboard
        </a>

        <a
          href={selectedTournament ? `/liga/${selectedTournament}` : "/admin"}
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">📊</span>
          Liga prikaz
        </a>

        <a
          href="/admin/achievementi"
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">🏅</span>
          Achievementi
        </a>

        <a
          href={selectedTournament ? `/story/${selectedTournament}` : "/admin"}
          className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 font-bold transition hover:border-[#f3dfad] hover:bg-[#d4b06a]/10"
        >
          <span className="block text-2xl text-[#d4b06a]">📱</span>
          Story generator
        </a>
      </div>

      <section className="card">
        <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">
          Prijave po turniru
        </h2>

        <p className="mt-2 text-zinc-400">
          Odaberi turnir i potvrdi ili odbij ekipe koje su se prijavile.
        </p>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold text-[#d4b06a]">
            Odaberi turnir
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
          </select>
        </div>

        {selectedTournamentData && (
          <div className="mt-6 rounded-2xl bg-[#12392b] p-5">
            <p className="text-sm text-zinc-400">Trenutni turnir</p>

            <h3 className="mt-1 text-xl font-bold text-[#d4b06a] sm:text-2xl">
              {selectedTournamentData.name}
            </h3>

            <p className="text-zinc-400">
              {selectedTournamentData.location} ·{" "}
              {selectedTournamentData.starts_at}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`/tournament/${selectedTournamentData.id}`}
                className="rounded-xl border border-[#d4b06a]/30 px-5 py-2 font-bold text-[#f3dfad] transition hover:bg-[#d4b06a]/10"
              >
                Otvori turnir
              </a>

              <a
                href={`/dashboard/${selectedTournamentData.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#d4b06a] px-5 py-2 font-black text-black transition hover:bg-[#f3dfad]"
              >
                Otvori TV dashboard
              </a>

              <a
                href={`/liga/${selectedTournamentData.id}`}
                className="rounded-xl border border-[#d4b06a]/30 px-5 py-2 font-bold text-[#f3dfad] transition hover:bg-[#d4b06a]/10"
              >
                Otvori liga prikaz
              </a>


              <a
                href={`/story/${selectedTournamentData.id}`}
                className="rounded-xl border border-[#d4b06a]/30 px-5 py-2 font-bold text-[#f3dfad] transition hover:bg-[#d4b06a]/10"
              >
                Story generator
              </a>

              <a
                href="/admin/achievementi"
                className="rounded-xl border border-[#d4b06a]/30 px-5 py-2 font-bold text-[#f3dfad] transition hover:bg-[#d4b06a]/10"
              >
                Achievementi
              </a>

              <button
                type="button"
                onClick={finishTournament}
                className="rounded-xl bg-red-600 px-5 py-2 font-black text-white transition hover:bg-red-500"
              >
                Turnir završen
              </button>
            </div>

            <p className="mt-4 text-sm text-zinc-400">
              Manual upis rezultata: {selectedTournamentData.manual_score_entry ? "uključen" : "isključen"}
              {selectedTournamentData.status === "finished" ? " · turnir je završen" : ""}
            </p>
          </div>
        )}

        <form onSubmit={addTeamByAdmin} className="mt-8 rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6">
          <h3 className="text-2xl font-black text-[#f3dfad]">Dodaj ekipu na dan turnira</h3>
          <p className="mt-2 text-sm text-zinc-400">Ekipa koju admin doda odmah je potvrđena. Mail partnera nije obavezan.</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
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

        {selectedTournamentData?.manual_score_entry && (
          <div className="mt-8 rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6">
            <h3 className="text-2xl font-black text-[#f3dfad]">Manualni upis rezultata</h3>
            <p className="mt-2 text-sm text-zinc-400">Upiši konačan rezultat meča. Veći rezultat automatski određuje pobjednika.</p>

            <div className="mt-5 space-y-3">
              {matches.length === 0 && <p className="text-zinc-400">Nema generiranih mečeva za ovaj turnir.</p>}
              {matches.map((match) => (
                <div key={match.id} className="rounded-xl border border-[#d4b06a]/10 bg-[#12392b] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-bold text-[#d4b06a]">
                        {match.team_a_name || match.team_a_seed || "Ekipa A"} vs {match.team_b_name || match.team_b_seed || "Ekipa B"}
                      </p>
                      <p className="text-sm text-zinc-400">
                        Runda {match.round || "-"} · status: {match.status || "scheduled"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="input w-24"
                        type="number"
                        min={0}
                        value={manualScores[match.id]?.scoreA ?? String(match.score_a ?? 0)}
                        onChange={(e) => setManualScores({ ...manualScores, [match.id]: { ...(manualScores[match.id] || { scoreA: "0", scoreB: "0" }), scoreA: e.target.value } })}
                      />
                      <span className="font-black text-[#f3dfad]">:</span>
                      <input
                        className="input w-24"
                        type="number"
                        min={0}
                        value={manualScores[match.id]?.scoreB ?? String(match.score_b ?? 0)}
                        onChange={(e) => setManualScores({ ...manualScores, [match.id]: { ...(manualScores[match.id] || { scoreA: "0", scoreB: "0" }), scoreB: e.target.value } })}
                      />
                      <button
                        type="button"
                        onClick={() => saveManualResult(match)}
                        className="rounded-xl bg-green-500 px-4 py-3 font-black text-black transition hover:bg-green-400"
                      >
                        Spremi
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 space-y-4">
          {loading && <p>Učitavam...</p>}

          {!loading && teams.length === 0 && (
            <div className="rounded-2xl bg-[#12392b] p-6">
              Nema prijavljenih ekipa za ovaj turnir.
            </div>
          )}

          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded-2xl border border-[#d4b06a]/15 bg-[#12392b] p-6"
            >
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <h3 className="text-xl font-bold text-[#d4b06a] sm:text-2xl">
                    {team.name}
                  </h3>

                  <p className="text-zinc-400">{team.city}</p>

                  <p className="text-zinc-400">
                    Kapetan: {team.captain_name}
                  </p>

                  <p className="text-zinc-400">
                    Igrači: {team.player_one} / {team.player_two}
                  </p>

                  <p className="text-zinc-400">{team.phone}</p>

                  <p className="text-zinc-400">{team.email}</p>
                </div>

                <div className="flex flex-col gap-3">
                  <span
                    className={`rounded-full px-4 py-2 text-center font-bold ${
                      team.status === "approved"
                        ? "bg-green-500/20 text-green-300"
                        : team.status === "rejected"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-[#d4b06a]/20 text-[#d4b06a]"
                    }`}
                  >
                    {team.status}
                  </span>

                  <button
                    onClick={() => updateStatus(team.id, "approved")}
                    className="rounded-xl bg-green-500 px-5 py-2 font-bold text-black"
                  >
                    Potvrdi
                  </button>

                  <button
                    onClick={() => updateStatus(team.id, "rejected")}
                    className="rounded-xl bg-red-500 px-5 py-2 font-bold text-white"
                  >
                    Odbij
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}