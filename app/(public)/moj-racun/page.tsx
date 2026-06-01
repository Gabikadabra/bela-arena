"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MojRacunPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState({
    full_name: "",
    nickname: "",
    city: "",
    phone: ""
  });

  const [teams, setTeams] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [openTournaments, setOpenTournaments] = useState<any[]>([]);
  const [selectedTournamentByTeam, setSelectedTournamentByTeam] = useState<Record<string, string>>({});
  const [registeringTeamId, setRegisteringTeamId] = useState<string | null>(null);
  const [myMatches, setMyMatches] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  useEffect(() => {
    loadAccount();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`moj-racun-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => loadAccount()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        () => loadAccount()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => loadAccount()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => loadAccount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  async function loadAccount() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setUser(null);
      return;
    }

    setUser(userData.user);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (profileData) {
      setProfile({
        full_name: profileData.full_name || "",
        nickname: profileData.nickname || "",
        city: profileData.city || "",
        phone: profileData.phone || ""
      });
    }

    const { data: teamData } = await supabase
      .from("teams")
      .select("*")
      .or(
        `captain_user_id.eq.${userData.user.id},partner_user_id.eq.${userData.user.id}`
      )
      .order("created_at", { ascending: false });

    setTeams(teamData || []);

    const { data: tournamentData } = await supabase
      .from("tournaments")
      .select("*")
      .order("starts_at", { ascending: true });

    setTournaments(tournamentData || []);
    setOpenTournaments((tournamentData || []).filter((tournament) => tournament.status === "open"));

    setSelectedTournamentByTeam((prev) => {
      const openTournamentData = (tournamentData || []).filter((tournament) => tournament.status === "open");
      const next = { ...prev };

      for (const team of teamData || []) {
        if (!next[team.id]) {
          next[team.id] = openTournamentData?.[0]?.id || "";
        }

        if (next[team.id] && !openTournamentData?.some((tournament) => tournament.id === next[team.id])) {
          next[team.id] = openTournamentData?.[0]?.id || "";
        }
      }

      return next;
    });

    const teamIds = (teamData || []).map((team) => team.id);

    if (teamIds.length > 0) {
      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .or(
          `team_a_id.in.(${teamIds.join(",")}),team_b_id.in.(${teamIds.join(",")})`
        )
        .order("created_at", { ascending: false });

      setMyMatches(matchData || []);
    } else {
      setMyMatches([]);
    }

    const { data: inviteData } = await supabase
      .from("teams")
      .select("*")
      .eq("partner_email", userData.user.email)
      .eq("invite_status", "pending")
      .order("created_at", { ascending: false });

    setInvites(inviteData || []);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!user) return;

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: profile.full_name,
      nickname: profile.nickname,
      city: profile.city,
      phone: profile.phone
    });

    if (error) {
      setMessageType("error");
      setMessage("Greška: " + error.message);
    } else {
      setMessageType("success");
      setMessage("Profil je uspješno spremljen.");
      loadAccount();
    }
  }

  async function acceptInvite(teamId: string) {
    if (!user) return;

    const { error } = await supabase
      .from("teams")
      .update({
        partner_user_id: user.id,
        invite_status: "accepted"
      })
      .eq("id", teamId);

    if (error) {
      alert(error.message);
      return;
    }

    loadAccount();
  }

  async function rejectInvite(teamId: string) {
    const { error } = await supabase
      .from("teams")
      .update({
        invite_status: "rejected"
      })
      .eq("id", teamId);

    if (error) {
      alert(error.message);
      return;
    }

    loadAccount();
  }

  async function registerSavedTeam(team: any) {
    if (!user) return;

    const tournamentId = selectedTournamentByTeam[team.id];

    if (!tournamentId) {
      setMessageType("error");
      setMessage("Odaberi turnir za prijavu ekipe.");
      return;
    }

    setRegisteringTeamId(team.id);
    setMessage("");

    const { data: existingTeam, error: existingError } = await supabase
      .from("teams")
      .select("id")
      .eq("tournament_id", tournamentId)
      .or(
        `captain_user_id.eq.${user.id},partner_user_id.eq.${user.id}`
      )
      .maybeSingle();

    if (existingError) {
      setMessageType("error");
      setMessage("Greška kod provjere prijave: " + existingError.message);
      setRegisteringTeamId(null);
      return;
    }

    if (existingTeam) {
      setMessageType("error");
      setMessage("Već imaš prijavljenu ekipu na taj turnir.");
      setRegisteringTeamId(null);
      return;
    }

    const selectedTournament = openTournaments.find(
      (tournament) => tournament.id === tournamentId
    );

    const partnerAlreadyAccepted = Boolean(team.partner_user_id);

    const { error } = await supabase.from("teams").insert({
      tournament_id: tournamentId,
      name: team.name || team.team_name || "Moja ekipa",
      city: team.city || "",
      captain_name: team.captain_name || team.captain || profile.full_name || user.email,
      captain_user_id: team.captain_user_id || user.id,
      player_one: team.player_one || team.playerOne || team.captain_name || "",
      player_two: team.player_two || team.playerTwo || "",
      partner_email: team.partner_email || "",
      partner_user_id: partnerAlreadyAccepted ? team.partner_user_id : null,
      invite_status: partnerAlreadyAccepted ? "accepted" : "pending",
      phone: team.phone || profile.phone || "",
      email: team.email || user.email || "",
      status: "pending"
    });

    if (error) {
      setMessageType("error");
      setMessage("Greška kod ponovne prijave ekipe: " + error.message);
      setRegisteringTeamId(null);
      return;
    }

    if (team.partner_email && !partnerAlreadyAccepted) {
      await fetch("/api/send-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          partnerEmail: team.partner_email,
          captainName: team.captain_name || profile.full_name || "Kapetan",
          teamName: team.name || team.team_name || "Moja ekipa",
          tournamentName: selectedTournament?.name || "Bela Arena"
        })
      });
    }

    setMessageType("success");
    setMessage(
      `Ekipa ${team.name || team.team_name || "Moja ekipa"} je prijavljena na ${
        selectedTournament?.name || "odabrani turnir"
      }.`
    );
    setRegisteringTeamId(null);
    loadAccount();
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const activeMatches = myMatches.filter((match) => match.status !== "finished");
  const finishedMatches = myMatches.filter((match) => match.status === "finished");

  const tournamentById = useMemo(() => {
    return new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  }, [tournaments]);

  const accountStats = useMemo(() => {
    const teamIds = new Set(teams.map((team) => team.id));
    const finished = myMatches.filter((match) => match.status === "finished");
    const wins = finished.filter((match) => teamIds.has(match.winner_id)).length;
    const losses = finished.length - wins;
    const active = myMatches.filter((match) => match.status !== "finished").length;
    const winrate = finished.length > 0 ? Math.round((wins / finished.length) * 100) : 0;

    return {
      active,
      finished: finished.length,
      losses,
      teams: teams.length,
      winrate,
      wins,
    };
  }, [teams, myMatches]);


  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <div className="card">
          <h1 className="text-4xl font-black text-[#f3dfad]">Moj račun</h1>

          <p className="mt-4 text-zinc-300">
            Moraš se prijaviti da vidiš svoj račun.
          </p>

          <div className="mt-6 flex gap-4">
            <a
              href="/login"
              className="btn-primary"
            >
              Login
            </a>

            <a
              href="/registracija"
              className="btn-outline"
            >
              Registracija
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
            Korisnički račun
          </p>

          <h1 className="text-4xl font-black text-[#f3dfad] sm:text-5xl">Moj račun</h1>

          <p className="mt-3 text-zinc-300">Prijavljen si kao: {user.email}</p>
        </div>

        <button
          onClick={logout}
          className="btn-danger"
        >
          Odjava
        </button>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AccountStat title="Moje ekipe" value={accountStats.teams} sub="spremljene i prijavljene ekipe" />
        <AccountStat title="Aktivni mečevi" value={accountStats.active} sub="trenutno čeka rezultat" />
        <AccountStat title="Omjer" value={`${accountStats.wins}-${accountStats.losses}`} sub={`${accountStats.winrate}% pobjeda`} />
        <AccountStat title="Završeni mečevi" value={accountStats.finished} sub="povijest tvojih ekipa" />
      </section>

      <section className="mb-8 card">
        <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Moji mečevi</h2>

        <p className="mt-2 text-zinc-400">
          Ovdje vidiš svoje aktivne mečeve i live rezultate.
        </p>

        <div className="mt-6 space-y-4">
          {activeMatches.length === 0 && (
            <div className="card-soft text-zinc-300">
              Trenutno nemaš aktivnih mečeva.
            </div>
          )}

          {activeMatches.map((match) => (
            <MatchCard key={match.id} match={match} showButtons />
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section className="card">
          <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Profil</h2>

          <form onSubmit={saveProfile} className="mt-6 space-y-4">
            <Field label="Ime i prezime">
              <input
                value={profile.full_name}
                onChange={(e) =>
                  setProfile({ ...profile, full_name: e.target.value })
                }
                className="input"
              />
            </Field>

            <Field label="Nadimak">
              <input
                value={profile.nickname}
                onChange={(e) =>
                  setProfile({ ...profile, nickname: e.target.value })
                }
                className="input"
              />
            </Field>

            <Field label="Grad">
              <input
                value={profile.city}
                onChange={(e) =>
                  setProfile({ ...profile, city: e.target.value })
                }
                className="input"
              />
            </Field>

            <Field label="Telefon">
              <input
                value={profile.phone}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
                className="input"
              />
            </Field>

            <button className="rounded-xl bg-[#d4b06a] px-8 py-4 font-black text-black">
              Spremi profil
            </button>
          </form>

          {message && (
            <div
              className={`mt-6 rounded-2xl border p-5 ${
                messageType === "success"
                  ? "border-green-500/30 bg-green-500/10 text-green-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              {message}
            </div>
          )}
        </section>

        <div className="space-y-8">
          <section className="card">
            <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Moje ekipe</h2>

            <div className="mt-6 space-y-4">
              {teams.length === 0 && (
                <div className="card-soft text-zinc-300">
                  Još nisi član nijedne ekipe.
                </div>
              )}

              {teams.map((team) => (
                <div
                  key={team.id}
                  className="card-soft"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-[#d4b06a] sm:text-2xl">
                        {team.name || team.team_name || "Ekipa bez imena"}
                      </h3>

                      <div className="mt-3 grid gap-2 text-sm text-zinc-400 sm:grid-cols-2">
                        {team.city && <p>Grad: {team.city}</p>}
                        {team.tournament_id && (
                          <p>Turnir: {tournamentById.get(team.tournament_id)?.name || "-"}</p>
                        )}
                        {team.captain_name && <p>Kapetan: {team.captain_name}</p>}
                        {team.player_one && <p>Igrač 1: {team.player_one}</p>}
                        {team.player_two && <p>Igrač 2: {team.player_two}</p>}
                        {team.partner_email && <p>Partner: {team.partner_email}</p>}
                        {team.phone && <p>Telefon: {team.phone}</p>}
                      </div>
                    </div>

                    <span className="w-fit rounded-full border border-[#d4b06a]/20 bg-[#d4b06a]/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#d4b06a]">
                      Spremljena ekipa
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <a href={`/ekipa/${team.id}`} className="btn-outline">
                      Profil ekipe
                    </a>
                    {team.tournament_id && (
                      <a href={`/tournament/${team.tournament_id}`} className="btn-outline">
                        Otvori turnir
                      </a>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <Field label="Prijavi ovu ekipu na turnir">
                      <select
                        value={selectedTournamentByTeam[team.id] || ""}
                        onChange={(e) =>
                          setSelectedTournamentByTeam((prev) => ({
                            ...prev,
                            [team.id]: e.target.value
                          }))
                        }
                        className="input"
                      >
                        <option value="">Odaberi otvoreni turnir</option>
                        {openTournaments.map((tournament) => (
                          <option key={tournament.id} value={tournament.id}>
                            {tournament.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <button
                      type="button"
                      onClick={() => registerSavedTeam(team)}
                      disabled={
                        registeringTeamId === team.id || openTournaments.length === 0
                      }
                      className="rounded-xl bg-[#d4b06a] px-6 py-4 font-black text-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {registeringTeamId === team.id ? "Prijavljujem..." : "Prijavi opet"}
                    </button>
                  </div>

                  {openTournaments.length === 0 && (
                    <p className="mt-3 text-sm text-zinc-500">
                      Trenutno nema otvorenih turnira za prijavu.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          
        </div>
      </div>

      <section className="mt-8 card">
        <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Povijest</h2>

        <p className="mt-2 text-zinc-400">
          Ovdje su tvoji završeni mečevi i rezultati koje si igrao.
        </p>

        <div className="mt-6 space-y-4">
          {finishedMatches.length === 0 && (
            <div className="card-soft text-zinc-300">
              Još nemaš odigranih mečeva.
            </div>
          )}

          {finishedMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </section>
    </main>
  );
}

function AccountStat({
  title,
  value,
  sub
}: {
  title: string;
  value: any;
  sub: string;
}) {
  return (
    <div className="rounded-3xl border border-[#d4b06a]/20 bg-[#0a2018] p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-2 text-3xl font-black text-[#f3dfad]">{value ?? 0}</p>
      <p className="mt-1 text-sm text-zinc-500">{sub}</p>
    </div>
  );
}

function MatchCard({
  match,
  showButtons = false
}: {
  match: any;
  showButtons?: boolean;
}) {
  const scoreA =
    match.team_a_score ?? match.score_a ?? match.points_a ?? match.result_a ?? 0;

  const scoreB =
    match.team_b_score ?? match.score_b ?? match.points_b ?? match.result_b ?? 0;

  return (
    <div className="card-soft">
      <h3 className="text-xl font-bold text-[#d4b06a] sm:text-2xl">
        {match.team_a_name} vs {match.team_b_name}
      </h3>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border border-[#d4b06a]/15 bg-[#0a2018] px-4 py-2 text-zinc-300">
          Status: {match.status}
        </span>

        <span className="rounded-full border border-[#d4b06a]/20 bg-[#d4b06a]/10 px-4 py-2 font-bold text-[#d4b06a]">
          Rezultat: {scoreA} : {scoreB}
        </span>
      </div>

      {match.created_at && (
        <p className="mt-3 text-sm text-zinc-500">
          Datum: {new Date(match.created_at).toLocaleString("hr-HR")}
        </p>
      )}

      {showButtons && (
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={`/mec/${match.id}`}
            className="btn-primary"
          >
            Upiši rezultat
          </a>

          <a
            href={`/live/${match.id}`}
            className="btn-outline"
          >
            Live prikaz
          </a>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#d4b06a]">
        {label}
      </span>
      {children}
    </label>
  );
}