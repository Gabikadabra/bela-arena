"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { syncTournamentAfterResult } from "@/lib/tournamentProgress";

type PageProps = {
  params: Promise<{ matchId: string }>;
};

type TeamSide = "A" | "B";

type SimpleCalculation = {
  rawA: number;
  rawB: number;
  declarationsA: number;
  declarationsB: number;
  belaA: number;
  belaB: number;
  finalA: number;
  finalB: number;
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
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );

  const [form, setForm] = useState({
    teamAScore: 0,
    teamBScore: 0,
    teamADeclarations: 0,
    teamBDeclarations: 0,
    teamABela: false,
    teamBBela: false,
    note: ""
  });

  useEffect(() => {
    loadData();
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`match-live-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`
        },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_games",
          filter: `match_id=eq.${matchId}`
        },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_sets",
          filter: `match_id=eq.${matchId}`
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const groupScoreLimit =
    tournament?.group_score_limit || tournament?.score_limit || 1001;

  const knockoutScoreLimit =
    tournament?.knockout_score_limit || tournament?.score_limit || 1001;

  const scoreLimit =
    match?.phase === "group" ? groupScoreLimit : knockoutScoreLimit;

  const legacyBestOf =
    Number(
      String(tournament?.match_format || "best_of_1").replace("best_of_", "")
    ) || 1;

  const groupBestOf = Number(tournament?.group_best_of || 1);

  const knockoutBestOf = Number(
    tournament?.knockout_best_of || legacyBestOf || 1
  );

  const matchBestOf = match?.phase === "group" ? groupBestOf : knockoutBestOf;

  const setsToWin = Math.ceil(matchBestOf / 2);

  const isFinished = match?.status === "finished";
  const isLocked = match?.status === "waiting" || match?.status === "bye";

  const currentSetGames = useMemo(
    () =>
      games.filter((game) => Number(game.set_number) === Number(currentSet)),
    [games, currentSet]
  );

  const totalA = useMemo(
    () =>
      currentSetGames.reduce(
        (sum, game) => sum + Number(game.team_a_total || 0),
        0
      ),
    [currentSetGames]
  );

  const totalB = useMemo(
    () =>
      currentSetGames.reduce(
        (sum, game) => sum + Number(game.team_b_total || 0),
        0
      ),
    [currentSetGames]
  );

  function prettyBestOf(bestOf: number) {
    if (bestOf === 5) return "Do 3 pobjede / best of 5";
    if (bestOf === 3) return "Do 2 pobjede / best of 3";
    return "Jedna partija";
  }

  function addDeclaration(team: TeamSide, value: number) {
    if (team === "A") {
      setForm((old) => ({
        ...old,
        teamADeclarations: Number(old.teamADeclarations || 0) + value
      }));
    } else {
      setForm((old) => ({
        ...old,
        teamBDeclarations: Number(old.teamBDeclarations || 0) + value
      }));
    }
  }

  function removeDeclaration(team: TeamSide, value: number) {
    if (team === "A") {
      setForm((old) => ({
        ...old,
        teamADeclarations: Math.max(
          0,
          Number(old.teamADeclarations || 0) - value
        )
      }));
    } else {
      setForm((old) => ({
        ...old,
        teamBDeclarations: Math.max(
          0,
          Number(old.teamBDeclarations || 0) - value
        )
      }));
    }
  }

  function clearDeclarations(team: TeamSide) {
    if (team === "A") {
      setForm((old) => ({
        ...old,
        teamADeclarations: 0
      }));
    } else {
      setForm((old) => ({
        ...old,
        teamBDeclarations: 0
      }));
    }
  }

  function toggleBela(team: TeamSide) {
    if (team === "A") {
      setForm((old) => ({
        ...old,
        teamABela: !old.teamABela,
        teamBBela: false
      }));
    } else {
      setForm((old) => ({
        ...old,
        teamBBela: !old.teamBBela,
        teamABela: false
      }));
    }
  }

  function calculateSimpleResult(): SimpleCalculation {
    const rawA = Number(form.teamAScore || 0);
    const rawB = Number(form.teamBScore || 0);

    const declarationsA = Number(form.teamADeclarations || 0);
    const declarationsB = Number(form.teamBDeclarations || 0);

    const belaA = form.teamABela ? 20 : 0;
    const belaB = form.teamBBela ? 20 : 0;

    return {
      rawA,
      rawB,
      declarationsA,
      declarationsB,
      belaA,
      belaB,
      finalA: rawA + declarationsA + belaA,
      finalB: rawB + declarationsB + belaB
    };
  }

  const preview = calculateSimpleResult();
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
      setMessage("Moraš biti prijavljen za upis rezultata.");
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
      setMessage(
        "Ovaj meč je zaključan. Prvo treba završiti prethodnu Berger rundu."
      );
      return;
    }

    if (preview.rawA < 0 || preview.rawB < 0) {
      setMessageType("error");
      setMessage("Bodovi ne mogu biti manji od 0.");
      return;
    }

    if (preview.finalA === 0 && preview.finalB === 0) {
      setMessageType("error");
      setMessage("Upiši rezultat prije spremanja.");
      return;
    }

    if (form.teamABela && form.teamBBela) {
      setMessageType("error");
      setMessage("Bela može biti samo kod jedne ekipe.");
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
      caller_team: null,
      called_team_fell: false,
      raw_team_a_tricks: preview.rawA,
      raw_team_b_tricks: preview.rawB,
      team_a_tricks: preview.rawA,
      team_b_tricks: preview.rawB,
      team_a_declarations: preview.declarationsA,
      team_b_declarations: preview.declarationsB,
      team_a_bela: form.teamABela,
      team_b_bela: form.teamBBela,
      team_a_total: preview.finalA,
      team_b_total: preview.finalB,
      note: form.note
    });

    if (gameError) {
      setSaving(false);
      setMessageType("error");
      setMessage("Greška kod spremanja rezultata: " + gameError.message);
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
      if (newTotalA === newTotalB) {
        setSaving(false);
        setMessageType("error");
        setMessage(
          "Set ne može završiti neriješeno. Dodaj još jedno dijeljenje ili ispravi rezultat."
        );
        return;
      }

      const setWinnerId =
        newTotalA > newTotalB ? match.team_a_id : match.team_b_id;

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
          setWinnerId === match.team_a_id
            ? match.team_a_name
            : match.team_b_name;

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

    await syncTournamentAfterResult({
      ...match,
      ...updateMatch,
      id: matchId,
      tournament_id: match.tournament_id,
      phase: match.phase,
      group_name: match.group_name,
      round: match.round,
      round_number: match.round_number
    });

    setForm({
      teamAScore: 0,
      teamBScore: 0,
      teamADeclarations: 0,
      teamBDeclarations: 0,
      teamABela: false,
      teamBBela: false,
      note: ""
    });

    setMessageType("success");
    setMessage(
      setFinished
        ? "Set je završen i rezultat je spremljen."
        : "Rezultat je dodan uživo."
    );

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
    <main className="page">
      <section className="hero-card">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="badge">Live unos rezultata</p>

            <h1 className="mt-4 text-3xl font-black leading-tight text-[var(--gold-light)] sm:text-4xl lg:text-5xl">
              {match.team_a_name} vs {match.team_b_name}
            </h1>

            <p className="muted mt-3 text-sm sm:text-base">
              Set {currentSet} · {match?.phase === "group" ? "Grupa" : "Knockout"}{" "}
              do {scoreLimit} · {prettyBestOf(matchBestOf)} · treba {setsToWin}{" "}
              set(ova)
            </p>
          </div>

          <div className="rounded-2xl border border-[rgba(212,176,106,0.15)] bg-[rgba(10,32,24,0.8)] p-5 text-left lg:text-right">
            <p className="text-sm text-white/55">Status meča</p>
            <p className="mt-1 text-2xl font-black text-[var(--gold-light)]">
              {isFinished ? "Završen" : isLocked ? "Zaključan" : "U tijeku"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Info
          title={match.team_a_name || "Ekipa A"}
          value={totalA}
          subtitle="Trenutni set"
        />
        <Info
          title={match.team_b_name || "Ekipa B"}
          value={totalB}
          subtitle="Trenutni set"
        />
        <Info
          title="Setovi A"
          value={match.sets_a || 0}
          subtitle={match.team_a_name}
        />
        <Info
          title="Setovi B"
          value={match.sets_b || 0}
          subtitle={match.team_b_name}
        />
      </section>

      {sets.length > 0 && (
        <section className="card mt-6">
          <h2 className="section-title">Završeni setovi</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sets.map((set) => (
              <div key={set.id} className="card-soft">
                <p className="text-sm text-white/55">Set {set.set_number}</p>
                <p className="mt-2 text-2xl font-black text-[var(--gold)]">
                  {set.team_a_score} : {set.team_b_score}
                </p>
                <p className="mt-2 text-sm text-white/55">
                  Status: {set.status}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!user && (
        <div className="mt-6 rounded-2xl border border-[rgba(212,176,106,0.3)] bg-[rgba(212,176,106,0.1)] p-5 text-[var(--gold-light)]">
          Moraš biti prijavljen za upis rezultata.
        </div>
      )}

      {isLocked && (
        <div className="mt-6 rounded-2xl border border-[rgba(212,176,106,0.3)] bg-[rgba(212,176,106,0.1)] p-5 text-[var(--gold-light)]">
          Ovaj meč je zaključan jer se grupe igraju Berger sustavom po rundama.
          Prvo se moraju završiti svi mečevi prethodne runde.
        </div>
      )}

      <form onSubmit={addGame} className="card mt-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="section-title">Novi unos</h2>
            <p className="muted mt-2">
              Upiši bodove za obje ekipe. Zvanja i belu dodaješ klikom.
            </p>
          </div>

          <div className="rounded-2xl border border-[rgba(212,176,106,0.15)] bg-[rgba(10,32,24,0.75)] p-4 text-sm text-white/75">
            Nakon unosa:{" "}
            <b className="text-[var(--gold-light)]">{afterSubmitA}</b> :{" "}
            <b className="text-[var(--gold-light)]">{afterSubmitB}</b>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ScoreInput
            label={match.team_a_name || "Ekipa A"}
            value={form.teamAScore}
            onChange={(value) => setForm({ ...form, teamAScore: value })}
          />

          <ScoreInput
            label={match.team_b_name || "Ekipa B"}
            value={form.teamBScore}
            onChange={(value) => setForm({ ...form, teamBScore: value })}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <DeclarationsCard
            teamName={match.team_a_name || "Ekipa A"}
            value={form.teamADeclarations}
            onAdd={(value) => addDeclaration("A", value)}
            onRemove={(value) => removeDeclaration("A", value)}
            onClear={() => clearDeclarations("A")}
          />

          <DeclarationsCard
            teamName={match.team_b_name || "Ekipa B"}
            value={form.teamBDeclarations}
            onAdd={(value) => addDeclaration("B", value)}
            onRemove={(value) => removeDeclaration("B", value)}
            onClear={() => clearDeclarations("B")}
          />
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-black text-[var(--gold-light)]">
            Bela
          </h3>
          <p className="muted mt-1 text-sm">
            Bela može biti označena samo za jednu ekipu.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => toggleBela("A")}
              className={`rounded-2xl border p-5 text-left font-black transition active:scale-[0.98] ${
                form.teamABela
                  ? "border-[var(--gold-light)] bg-[var(--gold)] text-[#0f2f24]"
                  : "border-[rgba(212,176,106,0.2)] bg-[rgba(10,32,24,0.75)] text-[var(--gold-light)]"
              }`}
            >
              Bela - {match.team_a_name}
            </button>

            <button
              type="button"
              onClick={() => toggleBela("B")}
              className={`rounded-2xl border p-5 text-left font-black transition active:scale-[0.98] ${
                form.teamBBela
                  ? "border-[var(--gold-light)] bg-[var(--gold)] text-[#0f2f24]"
                  : "border-[rgba(212,176,106,0.2)] bg-[rgba(10,32,24,0.75)] text-[var(--gold-light)]"
              }`}
            >
              Bela - {match.team_b_name}
            </button>
          </div>
        </div>

        <div className="card-soft mt-6">
          <h3 className="text-xl font-black text-[var(--gold-light)]">
            Pregled unosa
          </h3>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PreviewBox title="Bodovi A" value={preview.rawA} />
            <PreviewBox title="Zvanja A" value={preview.declarationsA} />
            <PreviewBox title="Bela A" value={preview.belaA} />
            <PreviewBox title="Ukupno A" value={preview.finalA} />

            <PreviewBox title="Bodovi B" value={preview.rawB} />
            <PreviewBox title="Zvanja B" value={preview.declarationsB} />
            <PreviewBox title="Bela B" value={preview.belaB} />
            <PreviewBox title="Ukupno B" value={preview.finalB} />
          </div>
        </div>

        <div className="mt-6">
          <Field label="Napomena">
            <textarea
              value={form.note}
              onChange={(event) =>
                setForm({ ...form, note: event.target.value })
              }
              className="input min-h-24"
              placeholder="npr. sporna situacija, dogovor..."
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={saving || !user || isFinished || isLocked}
          className="btn-primary mt-8 w-full py-4 text-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Spremam..." : "Spremi rezultat"}
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
        <h2 className="section-title">Povijest unosa</h2>

        <div className="mt-5 space-y-4">
          {games.length === 0 && (
            <div className="card-soft">
              <p className="muted">Još nema upisanih rezultata.</p>
            </div>
          )}

          {games.map((game) => (
            <div key={game.id} className="card-soft">
              <p className="text-sm text-white/45">
                Set {game.set_number} · Unos {game.game_number}
              </p>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <HistoryTeamBox
                  name={match.team_a_name}
                  tricks={game.team_a_tricks}
                  declarations={game.team_a_declarations}
                  bela={game.team_a_bela}
                  total={game.team_a_total}
                />

                <HistoryTeamBox
                  name={match.team_b_name}
                  tricks={game.team_b_tricks}
                  declarations={game.team_b_declarations}
                  bela={game.team_b_bela}
                  total={game.team_b_total}
                />
              </div>

              {game.note && (
                <p className="mt-3 text-sm text-white/55">
                  Napomena: {game.note}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function ScoreInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-2xl border border-[rgba(212,176,106,0.15)] bg-[rgba(10,32,24,0.7)] p-4">
      <span className="block text-sm font-black text-[var(--gold)]">
        {label}
      </span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full rounded-2xl border border-[rgba(212,176,106,0.15)] bg-[rgba(5,22,15,0.85)] px-4 py-5 text-center text-4xl font-black text-[var(--gold-light)] outline-none focus:border-[var(--gold)]"
        min={0}
        inputMode="numeric"
      />
    </label>
  );
}

function DeclarationsCard({
  teamName,
  value,
  onAdd,
  onRemove,
  onClear
}: {
  teamName: string;
  value: number;
  onAdd: (value: number) => void;
  onRemove: (value: number) => void;
  onClear: () => void;
}) {
  const values = [20, 50, 100, 150, 200];

  return (
    <div className="card-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[var(--gold)]">Zvanja</p>
          <h3 className="mt-1 text-xl font-black text-[var(--gold-light)]">
            {teamName}
          </h3>
        </div>

        <div className="rounded-2xl bg-[rgba(5,22,15,0.75)] px-4 py-3 text-right">
          <p className="text-xs text-white/45">Ukupno</p>
          <p className="text-2xl font-black text-[var(--gold-light)]">
            {value}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {values.map((declarationValue) => (
          <button
            key={declarationValue}
            type="button"
            onClick={() => onAdd(declarationValue)}
            className="rounded-xl border border-[rgba(212,176,106,0.2)] bg-[rgba(5,22,15,0.7)] py-3 text-sm font-black text-[var(--gold-light)] transition active:scale-95"
          >
            +{declarationValue}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        {values.map((declarationValue) => (
          <button
            key={declarationValue}
            type="button"
            onClick={() => onRemove(declarationValue)}
            className="rounded-xl border border-red-500/20 bg-red-500/10 py-3 text-sm font-black text-red-200 transition active:scale-95"
          >
            -{declarationValue}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onClear}
        className="mt-3 w-full rounded-xl border border-red-500/25 bg-red-500/10 py-3 font-black text-red-200"
      >
        Očisti zvanja
      </button>
    </div>
  );
}

function Info({
  title,
  value,
  subtitle
}: {
  title: string;
  value: any;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-[rgba(212,176,106,0.15)] bg-[rgba(10,32,24,0.8)] p-5">
      <p className="text-sm text-white/55">{title}</p>
      <p className="mt-2 text-4xl font-black text-[var(--gold-light)]">
        {value}
      </p>
      {subtitle && <p className="mt-1 text-sm text-white/40">{subtitle}</p>}
    </div>
  );
}

function PreviewBox({
  title,
  value
}: {
  title: string;
  value: any;
}) {
  return (
    <div className="rounded-xl bg-[rgba(5,22,15,0.55)] p-4">
      <p className="text-xs text-white/45">{title}</p>
      <p className="mt-1 text-xl font-black text-[var(--gold-light)]">
        {value}
      </p>
    </div>
  );
}

function HistoryTeamBox({
  name,
  tricks,
  declarations,
  bela,
  total
}: {
  name: string;
  tricks: any;
  declarations: any;
  bela: any;
  total: any;
}) {
  return (
    <div className="rounded-xl bg-[rgba(5,22,15,0.55)] p-4">
      <b className="text-[var(--gold-light)]">{name}</b>

      <div className="mt-2 space-y-1 text-sm text-white/65">
        <p>Bodovi: {tricks}</p>
        <p>Zvanja: {declarations}</p>
        <p>Bela: {bela ? "Da" : "Ne"}</p>
      </div>

      <p className="mt-3 text-xl font-black text-[var(--gold)]">
        Ukupno: {total}
      </p>
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
      <span className="mb-2 block text-sm font-black text-[var(--gold)]">
        {label}
      </span>
      {children}
    </label>
  );
}