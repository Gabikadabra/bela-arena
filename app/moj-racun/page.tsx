"use client";

import { useEffect, useState } from "react";
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
  const [myMatches, setMyMatches] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAccount();
  }, []);

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
      setMessage("Greška: " + error.message);
    } else {
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

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const activeMatches = myMatches.filter((match) => match.status !== "finished");
  const finishedMatches = myMatches.filter((match) => match.status === "finished");

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <div className="rounded-3xl border border-yellow-500/20 bg-zinc-950/80 p-8">
          <h1 className="text-4xl font-black text-yellow-400">Moj račun</h1>

          <p className="mt-4 text-zinc-300">
            Moraš se prijaviti da vidiš svoj račun.
          </p>

          <div className="mt-6 flex gap-4">
            <a
              href="/login"
              className="rounded-xl bg-yellow-400 px-6 py-3 font-bold text-black"
            >
              Login
            </a>

            <a
              href="/registracija"
              className="rounded-xl border border-yellow-500/40 px-6 py-3 font-bold text-yellow-300"
            >
              Registracija
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-4 inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
            Korisnički račun
          </p>

          <h1 className="text-5xl font-black text-yellow-400">Moj račun</h1>

          <p className="mt-3 text-zinc-300">Prijavljen si kao: {user.email}</p>
        </div>

        <button
          onClick={logout}
          className="rounded-xl border border-red-500/40 px-5 py-3 font-bold text-red-300 transition hover:bg-red-500/10"
        >
          Odjava
        </button>
      </div>

      <section className="mb-8 rounded-3xl border border-white/10 bg-zinc-950/80 p-8">
        <h2 className="text-3xl font-black text-yellow-400">Moji mečevi</h2>

        <p className="mt-2 text-zinc-400">
          Ovdje vidiš svoje aktivne mečeve i live rezultate.
        </p>

        <div className="mt-6 space-y-4">
          {activeMatches.length === 0 && (
            <div className="rounded-2xl bg-zinc-900 p-6 text-zinc-300">
              Trenutno nemaš aktivnih mečeva.
            </div>
          )}

          {activeMatches.map((match) => (
            <MatchCard key={match.id} match={match} showButtons />
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/80 p-8">
          <h2 className="text-3xl font-black text-yellow-400">Profil</h2>

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

            <button className="rounded-xl bg-yellow-400 px-8 py-4 font-black text-black">
              Spremi profil
            </button>
          </form>

          {message && (
            <div className="mt-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-green-300">
              {message}
            </div>
          )}
        </section>

        <div className="space-y-8">
          <section className="rounded-3xl border border-white/10 bg-zinc-950/80 p-8">
            <h2 className="text-3xl font-black text-yellow-400">Moje ekipe</h2>

            <div className="mt-6 space-y-4">
              {teams.length === 0 && (
                <div className="rounded-2xl bg-zinc-900 p-5 text-zinc-300">
                  Još nisi član nijedne ekipe.
                </div>
              )}

              {teams.map((team) => (
                <div
                  key={team.id}
                  className="rounded-2xl border border-white/10 bg-zinc-900 p-5"
                >
                  <h3 className="text-2xl font-bold text-yellow-300">
                    {team.name || team.team_name || "Ekipa bez imena"}
                  </h3>

                  

                  {team.partner_email && (
                    <p className="mt-1 text-zinc-400">
                      Partner: {team.partner_email}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          
        </div>
      </div>

      <section className="mt-8 rounded-3xl border border-white/10 bg-zinc-950/80 p-8">
        <h2 className="text-3xl font-black text-yellow-400">Povijest</h2>

        <p className="mt-2 text-zinc-400">
          Ovdje su tvoji završeni mečevi i rezultati koje si igrao.
        </p>

        <div className="mt-6 space-y-4">
          {finishedMatches.length === 0 && (
            <div className="rounded-2xl bg-zinc-900 p-6 text-zinc-300">
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
    <div className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
      <h3 className="text-2xl font-bold text-yellow-300">
        {match.team_a_name} vs {match.team_b_name}
      </h3>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border border-white/10 bg-zinc-950 px-4 py-2 text-zinc-300">
          Status: {match.status}
        </span>

        <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 font-bold text-yellow-300">
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
            className="rounded-xl bg-yellow-400 px-5 py-2 font-bold text-black"
          >
            Upiši rezultat
          </a>

          <a
            href={`/live/${match.id}`}
            className="rounded-xl border border-yellow-500/40 px-5 py-2 font-bold text-yellow-300"
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
      <span className="mb-2 block text-sm font-bold text-yellow-300">
        {label}
      </span>
      {children}
    </label>
  );
}