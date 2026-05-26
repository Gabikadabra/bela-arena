"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { syncTournamentAfterResult } from "@/lib/tournamentProgress";

type PageProps = {
  params: Promise<{ matchId: string }>;
};

type CallerTeam = "A" | "B";
type TeamKey = "A" | "B";

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

const DECLARATION_VALUES = [20, 50, 100, 150, 200];
const TRICKS_PRESETS = [0, 20, 40, 60, 80, 100, 120, 140, 162];

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
    note: "",
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
  const isLocked = match?.status === "waiting" || match?.status === "bye";

  const currentSetGames = useMemo(
    () => games.filter((game) => Number(game.set_number) === Number(currentSet)),
    [games, currentSet],
  );

  const totalA = useMemo(
    () => currentSetGames.reduce((sum, game) => sum + Number(game.team_a_total || 0), 0),
    [currentSetGames],
  );

  const totalB = useMemo(
    () => currentSetGames.reduce((sum, game) => sum + Number(game.team_b_total || 0), 0),
    [currentSetGames],
  );

  function prettyBestOf(bestOf: number) {
    if (bestOf === 5) return "Do 3 pobjede / best of 5";
    if (bestOf === 3) return "Do 2 pobjede / best of 3";
    return "Jedna partija";
  }

  function setBela(team: TeamKey, checked: boolean) {
    if (team === "A") {
      setForm({ ...form, teamABela: checked, teamBBela: checked ? false : form.teamBBela });
      return;
    }

    setForm({ ...form, teamBBela: checked, teamABela: checked ? false : form.teamABela });
  }

  function addDeclaration(team: TeamKey, value: number) {
    if (!DECLARATION_VALUES.includes(value)) return;

    if (team === "A") {
      setForm({ ...form, teamADeclarations: Math.max(0, Number(form.teamADeclarations || 0) + value) });
      return;
    }

    setForm({ ...form, teamBDeclarations: Math.max(0, Number(form.teamBDeclarations || 0) + value) });
  }

  function resetDeclaration(team: TeamKey) {
    if (team === "A") {
      setForm({ ...form, teamADeclarations: 0 });
      return;
    }

    setForm({ ...form, teamBDeclarations: 0 });
  }

  function calculateBelaHand(): HandCalculation {
    const rawA = Math.min(162, Math.max(0, Number(form.teamATricks || 0)));
    const rawB = Math.max(0, 162 - rawA);

    const declarationsA = Number(form.teamADeclarations || 0);
    const declarationsB = Number(form.teamBDeclarations || 0);
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
        allPoints,
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
      allPoints,
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
        .update({ team_a_id: winnerId, team_a_name: winnerName, status: nextMatch.team_b_id ? "scheduled" : "waiting" })
        .eq("id", nextMatch.id);
    } else {
      await supabase
        .from("matches")
        .update({ team_b_id: winnerId, team_b_name: winnerName, status: nextMatch.team_a_id ? "scheduled" : "waiting" })
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

    if (isLocked) {
      setMessageType("error");
      setMessage("Ovaj meč je zaključan. Prvo treba završiti prethodnu Berger rundu.");
      return;
    }

    if (form.teamABela && form.teamBBela) {
      setMessageType("error");
      setMessage("Belu ne mogu imati obje ekipe u istom dijeljenju.");
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
      note: form.note,
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
      submitted_by: user.id,
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
        finished_at: new Date().toISOString(),
      });

      if (setError) {
        setSaving(false);
        setMessageType("error");
        setMessage("Greška kod spremanja seta: " + setError.message);
        return;
      }

      const matchFinished = newSetsA >= setsToWin || newSetsB >= setsToWin;

      if (matchFinished) {
        const winnerName = setWinnerId === match.team_a_id ? match.team_a_name : match.team_b_name;

        updateMatch = {
          ...updateMatch,
          sets_a: newSetsA,
          sets_b: newSetsB,
          winner_id: setWinnerId,
          status: "finished",
          result_status: "submitted",
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
          status: "scheduled",
        };
      }
    }

    const { error: matchError } = await supabase.from("matches").update(updateMatch).eq("id", matchId);

    if (matchError) {
      setSaving(false);
      setMessageType("error");
      setMessage("Greška kod ažuriranja meča: " + matchError.message);
      return;
    }

    await syncTournamentAfterResult({
      ...match,
      ...updateMatch,
      id: matchId,
      tournament_id: match.tournament_id,
      phase: match.phase,
      group_name: match.group_name,
      round: match.round,
      round_number: match.round_number,
    });

    setForm({
      callerTeam: "A",
      teamATricks: 0,
      teamADeclarations: 0,
      teamBDeclarations: 0,
      teamABela: false,
      teamBBela: false,
      note: "",
    });

    setMessageType("success");
    setMessage(setFinished ? "Set je završen i spremljen." : "Dijeljenje je dodano uživo.");
    setSaving(false);
    await loadData();
  }

  if (loading) {
    return (
      <main className="page">
        <div className="card">
          <p className="muted">Učitavam meč...</p>
        </div>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="page">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-red-300">
          {message || "Meč nije pronađen."}
        </div>
      </main>
    );
  }

  return (
    <main className="page pb-28 sm:pb-12">
      <section className="hero-card mb-6 sm:mb-8">
        <span className="badge">Pametni live Bela blok</span>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="text-3xl font-black leading-tight text-[var(--gold-light)] sm:text-5xl">
              {match.team_a_name} <span className="text-[var(--gold)]">vs</span> {match.team_b_name}
            </h1>

            <p className="muted mt-3 text-sm sm:text-base">
              Set {currentSet} · {match?.phase === "group" ? "Grupa" : "Knockout"} do {scoreLimit} · {prettyBestOf(matchBestOf)} · treba {setsToWin} set(ova)
            </p>
          </div>

          <div className="rounded-2xl border border-[rgba(212,176,106,0.18)] bg-[rgba(10,32,24,0.85)] p-4 text-left lg:text-right">
            <p className="text-xs font-black uppercase tracking-widest text-white/45">Status meča</p>
            <p className="mt-1 text-2xl font-black text-[var(--gold-light)]">
              {isFinished ? "Završen" : isLocked ? "Zaključan" : "U tijeku"}
            </p>
          </div>
        </div>
      </section>

      <section className="sticky top-0 z-20 -mx-4 mb-6 border-y border-[rgba(212,176,106,0.14)] bg-[rgba(10,32,24,0.96)] px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-[1.5rem] sm:border sm:p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Info title={match.team_a_name || "Ekipa A"} value={totalA} subtitle="Trenutni set" compact />
          <Info title={match.team_b_name || "Ekipa B"} value={totalB} subtitle="Trenutni set" compact />
          <Info title="Setovi A" value={match.sets_a || 0} subtitle={match.team_a_name} compact />
          <Info title="Setovi B" value={match.sets_b || 0} subtitle={match.team_b_name} compact />
        </div>
      </section>

      {sets.length > 0 && (
        <section className="mb-6 card">
          <h2 className="section-title">Završeni setovi</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sets.map((set) => (
              <div key={set.id} className="card-soft">
                <p className="text-sm text-white/55">Set {set.set_number}</p>
                <p className="mt-2 text-2xl font-black text-[var(--gold)]">{set.team_a_score} : {set.team_b_score}</p>
                <p className="mt-1 text-sm text-white/55">Status: {set.status}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!user && <Notice text="Moraš biti prijavljen za upis dijeljenja." />}
      {isLocked && <Notice text="Ovaj meč je zaključan jer se grupe igraju Berger sustavom po rundama. Prvo se moraju završiti svi mečevi prethodne runde." />}

      <form onSubmit={addGame} className="card shadow-2xl">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="section-title">Novo dijeljenje</h2>
            <p className="muted mt-2 text-sm sm:text-base">
              Mobilno optimizirano: štihovi se biraju brzo, zvanja su samo bela vrijednosti, a belu može imati samo jedna ekipa.
            </p>
          </div>

          <div className="rounded-2xl border border-[rgba(212,176,106,0.15)] bg-[rgba(18,57,43,0.9)] p-4 text-sm text-white/75">
            Nakon unosa: <b className="text-[var(--gold)]">{afterSubmitA}</b> : <b className="text-[var(--gold)]">{afterSubmitB}</b>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <section>
            <p className="mb-3 text-sm font-black uppercase tracking-widest text-[var(--gold)]">Tko je zvao?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceButton active={form.callerTeam === "A"} onClick={() => setForm({ ...form, callerTeam: "A" })}>
                {match.team_a_name}
              </ChoiceButton>
              <ChoiceButton active={form.callerTeam === "B"} onClick={() => setForm({ ...form, callerTeam: "B" })}>
                {match.team_b_name}
              </ChoiceButton>
            </div>
          </section>

          <section className="card-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-[var(--gold)]">Štihovi</p>
                <p className="muted mt-1 text-sm">Upiši štihove ekipe A. Ekipa B se računa automatski.</p>
              </div>
              <div className="rounded-xl bg-[rgba(10,32,24,0.75)] px-4 py-3 text-sm font-bold text-white/80">
                B: <span className="text-[var(--gold)]">{preview.rawB}</span>
              </div>
            </div>

            <input
              type="range"
              value={form.teamATricks}
              onChange={(event) => setForm({ ...form, teamATricks: Number(event.target.value) })}
              className="mt-5 w-full accent-[#d4b06a]"
              min={0}
              max={162}
            />

            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <ScoreBig label={match.team_a_name} value={form.teamATricks} />
              <span className="text-2xl font-black text-[var(--gold)]">:</span>
              <ScoreBig label={match.team_b_name} value={preview.rawB} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-9">
              {TRICKS_PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, teamATricks: value })}
                  className={`rounded-xl border px-3 py-3 text-sm font-black transition ${
                    Number(form.teamATricks) === value
                      ? "border-[var(--gold-light)] bg-[var(--gold)] text-[#0f2f24]"
                      : "border-[rgba(212,176,106,0.14)] bg-[rgba(10,32,24,0.72)] text-white hover:border-[var(--gold)]"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <DeclarationPanel
              title={`Zvanja - ${match.team_a_name}`}
              value={form.teamADeclarations}
              belaChecked={form.teamABela}
              onAdd={(value) => addDeclaration("A", value)}
              onReset={() => resetDeclaration("A")}
              onBela={(checked) => setBela("A", checked)}
            />

            <DeclarationPanel
              title={`Zvanja - ${match.team_b_name}`}
              value={form.teamBDeclarations}
              belaChecked={form.teamBBela}
              onAdd={(value) => addDeclaration("B", value)}
              onReset={() => resetDeclaration("B")}
              onBela={(checked) => setBela("B", checked)}
            />
          </section>

          <section className="card-soft">
            <h3 className="text-xl font-black text-[var(--gold)]">Pregled obračuna</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <PreviewBox title="Normalno A" value={preview.normalA} />
              <PreviewBox title="Normalno B" value={preview.normalB} />
              <PreviewBox title="Pad" value={preview.calledTeamFell ? "DA" : "NE"} danger={preview.calledTeamFell} />
              <PreviewBox title="Final A" value={preview.finalA} />
              <PreviewBox title="Final B" value={preview.finalB} />
              <PreviewBox title="Svi bodovi" value={preview.allPoints} />
            </div>
          </section>

          <Field label="Napomena">
            <textarea
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              className="input min-h-24"
              placeholder="npr. sporna situacija, dogovor..."
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={saving || !user || isFinished || isLocked}
          className="btn-primary mt-8 w-full py-4 text-base disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg"
        >
          {saving ? "Spremam..." : "Dodaj dijeljenje"}
        </button>
      </form>

      {message && (
        <div className={`mt-6 rounded-2xl border p-5 ${messageType === "success" ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {message}
        </div>
      )}

      <section className="mt-10">
        <h2 className="section-title">Povijest dijeljenja</h2>

        <div className="mt-5 space-y-4">
          {games.length === 0 && (
            <div className="card-soft text-white/75">Još nema upisanih dijeljenja.</div>
          )}

          {games.map((game) => (
            <div key={game.id} className="card-soft">
              <p className="text-sm text-white/45">Set {game.set_number} · Dijeljenje {game.game_number}</p>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <GameTeamBox
                  name={match.team_a_name}
                  tricks={game.team_a_tricks}
                  declarations={game.team_a_declarations}
                  bela={game.team_a_bela}
                  total={game.team_a_total}
                />
                <GameTeamBox
                  name={match.team_b_name}
                  tricks={game.team_b_tricks}
                  declarations={game.team_b_declarations}
                  bela={game.team_b_bela}
                  total={game.team_b_total}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-blue-500/20 px-3 py-1 text-blue-300">
                  Zvali: {game.caller_team === "A" ? match.team_a_name : match.team_b_name}
                </span>
                <span className={`rounded-full px-3 py-1 ${game.called_team_fell ? "bg-red-500/20 text-red-300" : "bg-green-500/20 text-green-300"}`}>
                  Pad: {game.called_team_fell ? "Da" : "Ne"}
                </span>
              </div>

              {game.note && <p className="mt-3 text-sm text-white/55">Napomena: {game.note}</p>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Info({ title, value, subtitle, compact }: { title: string; value: any; subtitle?: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-[rgba(212,176,106,0.15)] bg-[rgba(10,32,24,0.88)] ${compact ? "p-3 sm:p-5" : "p-6"}`}>
      <p className="truncate text-xs font-bold text-white/50 sm:text-sm">{title}</p>
      <p className="mt-1 text-2xl font-black text-[var(--gold-light)] sm:text-4xl">{value}</p>
      {subtitle && <p className="mt-1 truncate text-xs text-white/35 sm:text-sm">{subtitle}</p>}
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return <div className="mb-6 rounded-2xl border border-[rgba(212,176,106,0.3)] bg-[rgba(212,176,106,0.1)] p-5 text-[var(--gold)]">{text}</div>;
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-16 rounded-2xl border p-4 text-left font-black transition sm:p-5 ${
        active
          ? "border-[var(--gold-light)] bg-[var(--gold)] text-[#0f2f24] shadow-lg"
          : "border-[rgba(212,176,106,0.15)] bg-[rgba(18,57,43,0.9)] text-white hover:border-[var(--gold-light)]"
      }`}
    >
      {children}
    </button>
  );
}

function ScoreBig({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl bg-[rgba(10,32,24,0.75)] p-4 text-center">
      <p className="truncate text-xs font-bold text-white/45">{label}</p>
      <p className="mt-1 text-3xl font-black text-[var(--gold-light)]">{value}</p>
    </div>
  );
}

function DeclarationPanel({ title, value, belaChecked, onAdd, onReset, onBela }: { title: string; value: number; belaChecked: boolean; onAdd: (value: number) => void; onReset: () => void; onBela: (checked: boolean) => void }) {
  return (
    <div className="card-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-[var(--gold)]">{title}</p>
          <p className="mt-1 text-3xl font-black text-[var(--gold-light)]">{value}</p>
        </div>
        <button type="button" onClick={onReset} className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200">
          Reset
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {DECLARATION_VALUES.map((declaration) => (
          <button key={declaration} type="button" onClick={() => onAdd(declaration)} className="rounded-xl border border-[rgba(212,176,106,0.14)] bg-[rgba(10,32,24,0.72)] px-3 py-3 font-black text-[var(--gold-light)] transition hover:border-[var(--gold)] hover:bg-[rgba(212,176,106,0.1)]">
            +{declaration}
          </button>
        ))}
      </div>

      <label className={`mt-4 flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 transition ${belaChecked ? "border-[var(--gold-light)] bg-[rgba(212,176,106,0.18)]" : "border-[rgba(212,176,106,0.14)] bg-[rgba(10,32,24,0.55)]"}`}>
        <span className="font-black text-[var(--gold-light)]">Bela +20</span>
        <input type="checkbox" checked={belaChecked} onChange={(event) => onBela(event.target.checked)} className="h-6 w-6 accent-[#d4b06a]" />
      </label>
    </div>
  );
}

function PreviewBox({ title, value, danger }: { title: string; value: any; danger?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${danger ? "bg-red-500/10 text-red-300" : "bg-[rgba(10,32,24,0.5)] text-zinc-200"}`}>
      <p className="text-xs text-white/45">{title}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function GameTeamBox({ name, tricks, declarations, bela, total }: { name: string; tricks: any; declarations: any; bela: any; total: any }) {
  return (
    <div className="rounded-xl bg-[rgba(18,57,43,0.88)] p-4">
      <b className="text-[var(--gold)]">{name}</b>
      <p className="mt-2 text-white/75">Štihovi: {tricks}</p>
      <p className="text-white/75">Zvanja: {declarations}</p>
      <p className="text-white/75">Bela: {bela ? "Da" : "Ne"}</p>
      <p className="mt-2 font-black text-[var(--gold)]">Ukupno: {total}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[var(--gold)]">{label}</span>
      {children}
    </label>
  );
}
