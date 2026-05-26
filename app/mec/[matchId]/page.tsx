"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PageProps = {
  params: Promise<{ matchId: string }>;
};

type CallerTeam = "A" | "B";

type HandCalculation = {
  rawA: number;
  rawB: number;
  normalA: number;
  normalB: number;
  finalA: number;
  finalB: number;
  calledTeamFell: boolean;
  allPoints: number;
};

export default function MecPage({ params }: PageProps) {
  const { matchId } = use(params);

  const [user, setUser] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [games, setGames] = useState<any[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [form, setForm] = useState({
    callerTeam: "A" as CallerTeam,
    teamATricks: 0,
    teamADeclarations: 0,
    teamBDeclarations: 0,
    teamABela: false,
    teamBBela: false,
    note: ""
  });

  useEffect(() => {
    loadData();
  }, [matchId]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();
    setUser(userData.user);

    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .maybeSingle();

    if (matchError || !matchData) {
      setMatch(null);
      setMessageType("error");
      setMessage("Meč nije pronađen.");
      setLoading(false);
      return;
    }

    setMatch(matchData);

    const { data: tournamentData } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", matchData.tournament_id)
      .maybeSingle();

    setTournament(tournamentData);

    const { data: gameData } = await supabase
      .from("match_games")
      .select("*")
      .eq("match_id", matchId)
      .order("set_number", { ascending: true })
      .order("game_number", { ascending: true });

    setGames(gameData || []);

    const { data: setData } = await supabase
      .from("match_sets")
      .select("*")
      .eq("match_id", matchId)
      .order("set_number", { ascending: true });

    setSets(setData || []);
    setLoading(false);
  }

  const currentSet = match?.current_set || 1;
  const groupScoreLimit = tournament?.group_score_limit || tournament?.score_limit || 1001;
  const knockoutScoreLimit = tournament?.knockout_score_limit || tournament?.score_limit || 1001;
  const scoreLimit = match?.phase === "group" ? groupScoreLimit : knockoutScoreLimit;
  const legacyBestOf = Number(String(tournament?.match_format || "best_of_1").replace("best_of_", "")) || 1;
  const groupBestOf = Number(tournament?.group_best_of || 1);
  const knockoutBestOf = Number(tournament?.knockout_best_of || legacyBestOf || 1);
  const matchBestOf = match?.phase === "group" ? groupBestOf : knockoutBestOf;
  const setsToWin = Math.ceil(matchBestOf / 2);
  const isFinished = match?.status === "finished";

  const currentSetGames = useMemo(
    () => games.filter((game) => Number(game.set_number) === Number(currentSet)),
    [games, currentSet]
  );

  const totalA = useMemo(
    () => currentSetGames.reduce((sum, game) => sum + Number(game.team_a_total || 0), 0),
    [currentSetGames]
  );

  const totalB = useMemo(
    () => currentSetGames.reduce((sum, game) => sum + Number(game.team_b_total || 0), 0),
    [currentSetGames]
  );

  function prettyBestOf(bestOf: number) {
    if (bestOf === 5) return "Do 3 pobjede / best of 5";
    if (bestOf === 3) return "Do 2 pobjede / best of 3";
    return "Jedna partija";
  }

  function calculateBelaHand(): HandCalculation {
    const rawA = Number(form.teamATricks);
    const rawB = Math.max(0, 162 - rawA);

    const declarationsA = Number(form.teamADeclarations);
    const declarationsB = Number(form.teamBDeclarations);
    const belaA = form.teamABela ? 20 : 0;
    const belaB = form.teamBBela ? 20 : 0;

    const normalA = rawA + declarationsA + belaA;
    const normalB = rawB + declarationsB + belaB;

    const callerScore = form.callerTeam === "A" ? normalA : normalB;
    const opponentScore = form.callerTeam === "A" ? normalB : normalA;
    const calledTeamFell = callerScore <= opponentScore;

    const allPoints = 162 + declarationsA + declarationsB + belaA + belaB;

    if (!calledTeamFell) {
      return {
        rawA,
        rawB,
        normalA,
        normalB,
        finalA: normalA,
        finalB: normalB,
        calledTeamFell: false,
        allPoints
      };
    }

    return {
      rawA,
      rawB,
      normalA,
      normalB,
      finalA: form.callerTeam === "A" ? 0 : allPoints,
      finalB: form.callerTeam === "B" ? 0 : allPoints,
      calledTeamFell: true,
      allPoints
    };
  }

  const preview = calculateBelaHand();
  const afterSubmitA = totalA + preview.finalA;
  const afterSubmitB = totalB + preview.finalB;

  async function advanceWinnerToNextMatch(winnerId: string, winnerName: string) {
  if (!match) return;

  const currentRound = match.round || match.round_number || 1;
  const nextRound = currentRound + 1;
  const nextMatchNumber = Math.ceil(match.match_number / 2);
  const nextSlot = match.match_number % 2 === 1 ? "A" : "B";

  const { data: nextMatch } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", match.tournament_id)
    .eq("phase", "knockout")
    .eq("round", nextRound)
    .eq("match_number", nextMatchNumber)
    .maybeSingle();

  if (!nextMatch) return;

  if (nextSlot === "A") {
    await supabase
      .from("matches")
      .update({
        team_a_id: winnerId,
        team_a_name: winnerName,
        status: nextMatch.team_b_id ? "scheduled" : "waiting"
      })
      .eq("id", nextMatch.id);
  } else {
    await supabase
      .from("matches")
      .update({
        team_b_id: winnerId,
        team_b_name: winnerName,
        status: nextMatch.team_a_id ? "scheduled" : "waiting"
      })
      .eq("id", nextMatch.id);
  }
}
  async function addGame(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!user) {
      setMessageType("error");
      setMessage("Moraš biti prijavljen za upis dijeljenja.");
      return;
    }

    if (!match || !tournament) {
      setMessageType("error");
      setMessage("Meč nije učitan.");
      return;
    }

    if (isFinished) {
      setMessageType("error");
      setMessage("Meč je već završen.");
      return;
    }

    if (Number(form.teamATricks) < 0 || Number(form.teamATricks) > 162) {
      setMessageType("error");
      setMessage("Štihovi ekipe A moraju biti između 0 i 162.");
      return;
    }

    setSaving(true);

    const gameNumber = currentSetGames.length + 1;
    const newTotalA = totalA + preview.finalA;
    const newTotalB = totalB + preview.finalB;

    const { error: gameError } = await supabase.from("match_games").insert({
      match_id: matchId,
      set_number: currentSet,
      game_number: gameNumber,
      submitted_by: user.id,
      caller_team: form.callerTeam,
      called_team_fell: preview.calledTeamFell,
      raw_team_a_tricks: preview.rawA,
      raw_team_b_tricks: preview.rawB,
      team_a_tricks: preview.rawA,
      team_b_tricks: preview.rawB,
      team_a_declarations: Number(form.teamADeclarations),
      team_b_declarations: Number(form.teamBDeclarations),
      team_a_bela: form.teamABela,
      team_b_bela: form.teamBBela,
      team_a_total: preview.finalA,
      team_b_total: preview.finalB,
      note: form.note
    });

    if (gameError) {
      setSaving(false);
      setMessageType("error");
      setMessage("Greška kod spremanja dijeljenja: " + gameError.message);
      return;
    }

    let updateMatch: any = {
      score_a: newTotalA,
      score_b: newTotalB,
      result_status: "submitted",
      submitted_by: user.id
    };

    const setFinished = newTotalA >= scoreLimit || newTotalB >= scoreLimit;

    if (setFinished) {
      const setWinnerId = newTotalA > newTotalB ? match.team_a_id : match.team_b_id;
      const setsA = Number(match.sets_a || 0);
      const setsB = Number(match.sets_b || 0);
      const newSetsA = setWinnerId === match.team_a_id ? setsA + 1 : setsA;
      const newSetsB = setWinnerId === match.team_b_id ? setsB + 1 : setsB;

      const { error: setError } = await supabase.from("match_sets").insert({
        match_id: matchId,
        set_number: currentSet,
        team_a_score: newTotalA,
        team_b_score: newTotalB,
        winner_id: setWinnerId,
        status: "finished",
        finished_at: new Date().toISOString()
      });

      if (setError) {
        setSaving(false);
        setMessageType("error");
        setMessage("Greška kod spremanja seta: " + setError.message);
        return;
      }

      const matchFinished = newSetsA >= setsToWin || newSetsB >= setsToWin;

      if (matchFinished) {
        const winnerName =
          setWinnerId === match.team_a_id ? match.team_a_name : match.team_b_name;

        updateMatch = {
          ...updateMatch,
          sets_a: newSetsA,
          sets_b: newSetsB,
          winner_id: setWinnerId,
          status: "finished",
          result_status: "submitted"
        };

        await advanceWinnerToNextMatch(setWinnerId, winnerName);
      } else {
        updateMatch = {
          ...updateMatch,
          sets_a: newSetsA,
          sets_b: newSetsB,
          current_set: currentSet + 1,
          score_a: 0,
          score_b: 0,
          status: "scheduled"
        };
      }
    }

    const { error: matchError } = await supabase
      .from("matches")
      .update(updateMatch)
      .eq("id", matchId);

    if (matchError) {
      setSaving(false);
      setMessageType("error");
      setMessage("Greška kod ažuriranja meča: " + matchError.message);
      return;
    }

    setForm({
      callerTeam: "A",
      teamATricks: 0,
      teamADeclarations: 0,
      teamBDeclarations: 0,
      teamABela: false,
      teamBBela: false,
      note: ""
    });

    setMessageType("success");
    setMessage(setFinished ? "Set je završen i spremljen." : "Dijeljenje je dodano uživo.");
    setSaving(false);
    await loadData();
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="card">
          <p className="text-zinc-300">Učitavam meč...</p>
        </div>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-red-300">
          {message || "Meč nije pronađen."}
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
            Pametni live Bela blok
          </p>

          <h1 className="text-2xl font-black text-[#f3dfad] sm:text-3xl sm:text-4xl md:text-5xl">
            {match.team_a_name} vs {match.team_b_name}
          </h1>

          <p className="mt-3 text-zinc-300">
            Set {currentSet} · {match?.phase === "group" ? "Grupa" : "Knockout"} do {scoreLimit} · {prettyBestOf(matchBestOf)} · treba {setsToWin} set(ova)
          </p>
        </div>

        <div className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-5 text-right">
          <p className="text-sm text-zinc-400">Status meča</p>
          <p className="mt-1 text-2xl font-black text-[#f3dfad]">
            {isFinished ? "Završen" : "U tijeku"}
          </p>
        </div>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-4">
        <Info title={match.team_a_name || "Ekipa A"} value={totalA} subtitle="Trenutni set" />
        <Info title={match.team_b_name || "Ekipa B"} value={totalB} subtitle="Trenutni set" />
        <Info title="Setovi A" value={match.sets_a || 0} subtitle={match.team_a_name} />
        <Info title="Setovi B" value={match.sets_b || 0} subtitle={match.team_b_name} />
      </section>

      {sets.length > 0 && (
        <section className="mb-8 card">
          <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Završeni setovi</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {sets.map((set) => (
              <div key={set.id} className="rounded-2xl bg-[#12392b] p-5">
                <p className="text-sm text-zinc-400">Set {set.set_number}</p>
                <p className="mt-2 text-xl font-black text-[#d4b06a] sm:text-2xl">
                  {set.team_a_score} : {set.team_b_score}
                </p>
                <p className="mt-2 text-sm text-zinc-400">Status: {set.status}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!user && (
        <div className="mb-8 rounded-2xl border border-[#d4b06a]/30 bg-[#d4b06a]/10 p-5 text-[#d4b06a]">
          Moraš biti prijavljen za upis dijeljenja.
        </div>
      )}

      <form
        onSubmit={addGame}
        className="card shadow-2xl"
      >
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Novo dijeljenje</h2>
            <p className="mt-2 text-zinc-400">
              Upiši samo štihove ekipe A. Druga ekipa se računa automatski: 162 - štihovi ekipe A.
            </p>
          </div>

          <div className="rounded-2xl bg-[#12392b] p-4 text-sm text-zinc-300">
            Nakon ovog unosa: <b className="text-[#d4b06a]">{afterSubmitA}</b> :{" "}
            <b className="text-[#d4b06a]">{afterSubmitB}</b>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-bold text-[#d4b06a]">Tko je zvao?</label>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, callerTeam: "A" })}
                className={`rounded-2xl border p-5 font-black transition ${
                  form.callerTeam === "A"
                    ? "border-[#f3dfad] bg-[#d4b06a] text-black"
                    : "border-[#d4b06a]/15 bg-[#12392b] text-white hover:border-[#f3dfad]"
                }`}
              >
                {match.team_a_name}
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, callerTeam: "B" })}
                className={`rounded-2xl border p-5 font-black transition ${
                  form.callerTeam === "B"
                    ? "border-[#f3dfad] bg-[#d4b06a] text-black"
                    : "border-[#d4b06a]/15 bg-[#12392b] text-white hover:border-[#f3dfad]"
                }`}
              >
                {match.team_b_name}
              </button>
            </div>
          </div>

          <Field label={`Štihovi - ${match.team_a_name}`}>
            <input
              type="number"
              value={form.teamATricks}
              onChange={(event) =>
                setForm({ ...form, teamATricks: Number(event.target.value) })
              }
              className="input"
              min={0}
              max={162}
            />
          </Field>

          <Field label={`Automatski štihovi - ${match.team_b_name}`}>
            <input
              type="number"
              value={preview.rawB}
              className="input opacity-70"
              readOnly
            />
          </Field>

          <Field label={`Zvanja - ${match.team_a_name}`}>
            <input
              type="number"
              value={form.teamADeclarations}
              onChange={(event) =>
                setForm({ ...form, teamADeclarations: Number(event.target.value) })
              }
              className="input"
              min={0}
            />
          </Field>

          <Field label={`Zvanja - ${match.team_b_name}`}>
            <input
              type="number"
              value={form.teamBDeclarations}
              onChange={(event) =>
                setForm({ ...form, teamBDeclarations: Number(event.target.value) })
              }
              className="input"
              min={0}
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-3 card-soft">
            <input
              type="checkbox"
              checked={form.teamABela}
              onChange={(event) => setForm({ ...form, teamABela: event.target.checked })}
              className="h-5 w-5"
            />
            <span className="font-bold text-[#d4b06a]">Bela za {match.team_a_name}</span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 card-soft">
            <input
              type="checkbox"
              checked={form.teamBBela}
              onChange={(event) => setForm({ ...form, teamBBela: event.target.checked })}
              className="h-5 w-5"
            />
            <span className="font-bold text-[#d4b06a]">Bela za {match.team_b_name}</span>
          </label>

          <div className="md:col-span-2 card-soft">
            <h3 className="text-xl font-black text-[#d4b06a]">Pregled obračuna</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <PreviewBox title="Normalno A" value={preview.normalA} />
              <PreviewBox title="Normalno B" value={preview.normalB} />
              <PreviewBox title="Pad" value={preview.calledTeamFell ? "DA" : "NE"} danger={preview.calledTeamFell} />
              <PreviewBox title="Final A" value={preview.finalA} />
              <PreviewBox title="Final B" value={preview.finalB} />
              <PreviewBox title="Svi bodovi" value={preview.allPoints} />
            </div>
          </div>

          <div className="md:col-span-2">
            <Field label="Napomena">
              <textarea
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                className="input min-h-24"
                placeholder="npr. sporna situacija, dogovor..."
              />
            </Field>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !user || isFinished}
          className="mt-8 rounded-xl bg-[#d4b06a] px-8 py-4 font-black text-black transition hover:bg-[#f3dfad] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Spremam..." : "Dodaj dijeljenje"}
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

      <section className="mt-10">
        <h2 className="text-2xl font-black text-[#f3dfad] sm:text-3xl">Povijest dijeljenja</h2>

        <div className="mt-5 space-y-4">
          {games.length === 0 && (
            <div className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6 text-zinc-300">
              Još nema upisanih dijeljenja.
            </div>
          )}

          {games.map((game) => (
            <div key={game.id} className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-5">
              <p className="text-sm text-zinc-500">
                Set {game.set_number} · Dijeljenje {game.game_number}
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-[#12392b] p-4">
                  <b className="text-[#d4b06a]">{match.team_a_name}</b>
                  <p className="mt-2 text-zinc-300">Štihovi: {game.team_a_tricks}</p>
                  <p className="text-zinc-300">Zvanja: {game.team_a_declarations}</p>
                  <p className="text-zinc-300">Bela: {game.team_a_bela ? "Da" : "Ne"}</p>
                  <p className="mt-2 font-bold text-[#d4b06a]">Ukupno: {game.team_a_total}</p>
                </div>

                <div className="rounded-xl bg-[#12392b] p-4">
                  <b className="text-[#d4b06a]">{match.team_b_name}</b>
                  <p className="mt-2 text-zinc-300">Štihovi: {game.team_b_tricks}</p>
                  <p className="text-zinc-300">Zvanja: {game.team_b_declarations}</p>
                  <p className="text-zinc-300">Bela: {game.team_b_bela ? "Da" : "Ne"}</p>
                  <p className="mt-2 font-bold text-[#d4b06a]">Ukupno: {game.team_b_total}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-blue-300">
                  Zvali: {game.caller_team === "A" ? match.team_a_name : match.team_b_name}
                </span>
                <span className={`rounded-full px-3 py-1 ${game.called_team_fell ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>
                  Pad: {game.called_team_fell ? "Da" : "Ne"}
                </span>
              </div>

              {game.note && <p className="mt-3 text-sm text-zinc-400">Napomena: {game.note}</p>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Info({ title, value, subtitle }: { title: string; value: any; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-[#d4b06a]/15 bg-[#0a2018] p-6">
      <p className="text-sm text-zinc-400">{title}</p>
      <p className="mt-2 text-4xl font-black text-[#f3dfad]">{value}</p>
      {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
    </div>
  );
}

function PreviewBox({ title, value, danger }: { title: string; value: any; danger?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${danger ? "bg-red-500/10 text-red-300" : "bg-[#0a2018]/45 text-zinc-200"}`}>
      <p className="text-xs text-zinc-400">{title}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#d4b06a]">{label}</span>
      {children}
    </label>
  );
}
