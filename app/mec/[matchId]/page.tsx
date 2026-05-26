"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
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

  const loadingRef = useRef(false);

  const [form, setForm] = useState({
    teamAScore: "",
    teamADeclarations: 0,
    teamBDeclarations: 0,
    teamABela: false,
    teamBBela: false,
    note: ""
  });

  const [editingGame, setEditingGame] = useState<any>(null);

  const [editForm, setEditForm] = useState({
    teamAScore: "",
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
          loadData(false);
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
          loadData(false);
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
          loadData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  async function loadData(showLoader = true) {
    if (loadingRef.current) return;

    loadingRef.current = true;

    if (showLoader) {
      setLoading(true);
    }

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
      loadingRef.current = false;
      return;
    }

    setMatch(matchData);

    const [{ data: tournamentData }, { data: gameData }, { data: setData }] =
      await Promise.all([
        supabase
          .from("tournaments")
          .select("*")
          .eq("id", matchData.tournament_id)
          .maybeSingle(),

        supabase
          .from("match_games")
          .select("*")
          .eq("match_id", matchId)
          .order("set_number", { ascending: true })
          .order("game_number", { ascending: true }),

        supabase
          .from("match_sets")
          .select("*")
          .eq("match_id", matchId)
          .order("set_number", { ascending: true })
      ]);

    setTournament(tournamentData);
    setGames(gameData || []);
    setSets(setData || []);

    setLoading(false);
    loadingRef.current = false;
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

  function calculateFromForm(source: {
    teamAScore: string;
    teamADeclarations: number;
    teamBDeclarations: number;
    teamABela: boolean;
    teamBBela: boolean;
  }): SimpleCalculation {
    const rawA = Math.min(162, Math.max(0, Number(source.teamAScore || 0)));
    const rawB = 162 - rawA;

    const declarationsA = Number(source.teamADeclarations || 0);
    const declarationsB = Number(source.teamBDeclarations || 0);

    const belaA = source.teamABela ? 20 : 0;
    const belaB = source.teamBBela ? 20 : 0;

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

  function calculateSimpleResult(): SimpleCalculation {
    return calculateFromForm(form);
  }

  function calculateEditResult(): SimpleCalculation {
    return calculateFromForm(editForm);
  }

  const preview = calculateSimpleResult();
  const editPreview = calculateEditResult();

  const afterSubmitA = totalA + preview.finalA;
  const afterSubmitB = totalB + preview.finalB;

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

  function openEditGame(game: any) {
    setEditingGame(game);

    setEditForm({
      teamAScore: String(game.team_a_tricks ?? game.raw_team_a_tricks ?? 0),
      teamADeclarations: Number(game.team_a_declarations || 0),
      teamBDeclarations: Number(game.team_b_declarations || 0),
      teamABela: Boolean(game.team_a_bela),
      teamBBela: Boolean(game.team_b_bela),
      note: game.note || ""
    });
  }

  function closeEditGame() {
    setEditingGame(null);

    setEditForm({
      teamAScore: "",
      teamADeclarations: 0,
      teamBDeclarations: 0,
      teamABela: false,
      teamBBela: false,
      note: ""
    });
  }

  function toggleEditBela(team: TeamSide) {
    if (team === "A") {
      setEditForm((old) => ({
        ...old,
        teamABela: !old.teamABela,
        teamBBela: false
      }));
    } else {
      setEditForm((old) => ({
        ...old,
        teamBBela: !old.teamBBela,
        teamABela: false
      }));
    }
  }

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

  async function rebuildMatchAfterHistoryChange() {
    if (!match) return;

    const { data: freshGames, error: gamesError } = await supabase
      .from("match_games")
      .select("*")
      .eq("match_id", matchId)
      .order("set_number", { ascending: true })
      .order("game_number", { ascending: true });

    if (gamesError) throw gamesError;

    const allGames = freshGames || [];

    const { error: deleteSetsError } = await supabase
      .from("match_sets")
      .delete()
      .eq("match_id", matchId);

    if (deleteSetsError) throw deleteSetsError;

    let setsA = 0;
    let setsB = 0;
    let activeSet = 1;
    let activeScoreA = 0;
    let activeScoreB = 0;
    let finalWinnerId: string | null = null;
    let finalStatus = "scheduled";

    const setNumbers = Array.from(
      new Set(allGames.map((game) => Number(game.set_number || 1)))
    ).sort((a, b) => a - b);

    for (const setNumber of setNumbers) {
      const setGames = allGames.filter(
        (game) => Number(game.set_number || 1) === setNumber
      );

      const setScoreA = setGames.reduce(
        (sum, game) => sum + Number(game.team_a_total || 0),
        0
      );

      const setScoreB = setGames.reduce(
        (sum, game) => sum + Number(game.team_b_total || 0),
        0
      );

      const setIsFinished =
        (setScoreA >= scoreLimit || setScoreB >= scoreLimit) &&
        setScoreA !== setScoreB;

      if (setIsFinished) {
        const setWinnerId =
          setScoreA > setScoreB ? match.team_a_id : match.team_b_id;

        if (setWinnerId === match.team_a_id) {
          setsA += 1;
        } else {
          setsB += 1;
        }

        const { error: insertSetError } = await supabase
          .from("match_sets")
          .insert({
            match_id: matchId,
            set_number: setNumber,
            team_a_score: setScoreA,
            team_b_score: setScoreB,
            winner_id: setWinnerId,
            status: "finished",
            finished_at: new Date().toISOString()
          });

        if (insertSetError) throw insertSetError;

        if (setsA >= setsToWin || setsB >= setsToWin) {
          finalWinnerId = setsA > setsB ? match.team_a_id : match.team_b_id;
          finalStatus = "finished";
          activeSet = setNumber;
          activeScoreA = setScoreA;
          activeScoreB = setScoreB;
          break;
        }

        activeSet = setNumber + 1;
        activeScoreA = 0;
        activeScoreB = 0;
      } else {
        activeSet = setNumber;
        activeScoreA = setScoreA;
        activeScoreB = setScoreB;
        break;
      }
    }

    if (allGames.length === 0) {
      activeSet = 1;
      activeScoreA = 0;
      activeScoreB = 0;
      setsA = 0;
      setsB = 0;
      finalWinnerId = null;
      finalStatus = "scheduled";
    }

    const updateMatch = {
      score_a: activeScoreA,
      score_b: activeScoreB,
      sets_a: setsA,
      sets_b: setsB,
      current_set: activeSet,
      winner_id: finalWinnerId,
      status: finalStatus,
      result_status: allGames.length > 0 ? "submitted" : "draft",
      submitted_by: user?.id || match.submitted_by || null
    };

    const { error: matchUpdateError } = await supabase
      .from("matches")
      .update(updateMatch)
      .eq("id", matchId);

    if (matchUpdateError) throw matchUpdateError;

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

    await loadData(false);
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

    if (preview.rawA < 0 || preview.rawA > 162) {
      setMessageType("error");
      setMessage("Bodovi moraju biti između 0 i 162.");
      return;
    }

    if (form.teamAScore === "") {
      setMessageType("error");
      setMessage("Upiši bodove prve ekipe.");
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
          "Set ne može završiti neriješeno. Dodaj još jedan unos ili ispravi rezultat."
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
      teamAScore: "",
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
    await loadData(false);
  }

  async function saveEditedGame(event: React.FormEvent) {
    event.preventDefault();

    if (!editingGame) return;

    if (!user) {
      setMessageType("error");
      setMessage("Moraš biti prijavljen.");
      return;
    }

    if (editForm.teamAScore === "") {
      setMessageType("error");
      setMessage("Upiši bodove prve ekipe.");
      return;
    }

    if (editForm.teamABela && editForm.teamBBela) {
      setMessageType("error");
      setMessage("Bela može biti samo kod jedne ekipe.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const result = calculateEditResult();

      const { error } = await supabase
        .from("match_games")
        .update({
          raw_team_a_tricks: result.rawA,
          raw_team_b_tricks: result.rawB,
          team_a_tricks: result.rawA,
          team_b_tricks: result.rawB,
          team_a_declarations: result.declarationsA,
          team_b_declarations: result.declarationsB,
          team_a_bela: editForm.teamABela,
          team_b_bela: editForm.teamBBela,
          team_a_total: result.finalA,
          team_b_total: result.finalB,
          note: editForm.note
        })
        .eq("id", editingGame.id);

      if (error) throw error;

      await rebuildMatchAfterHistoryChange();

      closeEditGame();
      setMessageType("success");
      setMessage("Unos je uspješno uređen.");
    } catch (error: any) {
      setMessageType("error");
      setMessage("Greška kod uređivanja: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteGame(game: any) {
    const confirmDelete = window.confirm(
      "Jesi siguran da želiš obrisati ovaj unos? Rezultat meča će se ponovno izračunati."
    );

    if (!confirmDelete) return;

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("match_games")
        .delete()
        .eq("id", game.id);

      if (error) throw error;

      await rebuildMatchAfterHistoryChange();

      setMessageType("success");
      setMessage("Unos je obrisan i rezultat je ponovno izračunat.");
    } catch (error: any) {
      setMessageType("error");
      setMessage("Greška kod brisanja: " + error.message);
    } finally {
      setSaving(false);
    }
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
    <main className="page pb-24">
      <section className="hero-card">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="badge">Live unos rezultata</p>

            <h1 className="mt-4 text-3xl font-black leading-tight text-[var(--gold-light)] sm:text-4xl lg:text-5xl">
              {match.team_a_name} vs {match.team_b_name}
            </h1>

            <p className="muted mt-3 text-sm sm:text-base">
              Set {currentSet} ·{" "}
              {match?.phase === "group" ? "Grupa" : "Knockout"} do{" "}
              {scoreLimit} · {prettyBestOf(matchBestOf)} · treba {setsToWin}{" "}
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

      <section className="sticky top-0 z-20 -mx-4 mt-5 border-y border-[rgba(212,176,106,0.12)] bg-[rgba(10,32,24,0.96)] px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        </div>
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
              Upiši bodove za prvu ekipu. Druga se računa automatski kao 162
              minus bodovi prve ekipe. Zvanja i belu dodaješ klikom.
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

          <AutoScoreBox
            label={match.team_b_name || "Ekipa B"}
            value={preview.rawB}
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
            <PreviewBox title="Bodovi B" value={preview.rawB} />
            <PreviewBox title="Zvanja A" value={preview.declarationsA} />
            <PreviewBox title="Zvanja B" value={preview.declarationsB} />
            <PreviewBox title="Bela A" value={preview.belaA} />
            <PreviewBox title="Bela B" value={preview.belaB} />
            <PreviewBox title="Ukupno A" value={preview.finalA} />
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

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => openEditGame(game)}
                  disabled={saving}
                  className="rounded-xl border border-[rgba(212,176,106,0.35)] bg-[rgba(212,176,106,0.08)] px-4 py-3 font-black text-[var(--gold-light)] transition active:scale-95 disabled:opacity-50"
                >
                  Uredi unos
                </button>

                <button
                  type="button"
                  onClick={() => deleteGame(game)}
                  disabled={saving}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-black text-red-200 transition active:scale-95 disabled:opacity-50"
                >
                  Obriši unos
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {editingGame && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 backdrop-blur sm:items-center sm:justify-center">
          <form
            onSubmit={saveEditedGame}
            className="max-h-[92vh] w-full overflow-y-auto rounded-3xl border border-[rgba(212,176,106,0.25)] bg-[#0a2018] p-5 shadow-2xl sm:max-w-3xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="badge">Uređivanje unosa</p>

                <h2 className="mt-3 text-2xl font-black text-[var(--gold-light)]">
                  Set {editingGame.set_number} · Unos {editingGame.game_number}
                </h2>

                <p className="muted mt-2 text-sm">
                  Promijeni bodove prve ekipe. Druga ekipa se računa automatski.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditGame}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-black text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <ScoreInput
                label={match.team_a_name || "Ekipa A"}
                value={editForm.teamAScore}
                onChange={(value) =>
                  setEditForm({ ...editForm, teamAScore: value })
                }
              />

              <AutoScoreBox
                label={match.team_b_name || "Ekipa B"}
                value={editPreview.rawB}
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <EditDeclarationsCard
                teamName={match.team_a_name || "Ekipa A"}
                value={editForm.teamADeclarations}
                onAdd={(value) =>
                  setEditForm({
                    ...editForm,
                    teamADeclarations:
                      Number(editForm.teamADeclarations || 0) + value
                  })
                }
                onRemove={(value) =>
                  setEditForm({
                    ...editForm,
                    teamADeclarations: Math.max(
                      0,
                      Number(editForm.teamADeclarations || 0) - value
                    )
                  })
                }
                onClear={() =>
                  setEditForm({ ...editForm, teamADeclarations: 0 })
                }
              />

              <EditDeclarationsCard
                teamName={match.team_b_name || "Ekipa B"}
                value={editForm.teamBDeclarations}
                onAdd={(value) =>
                  setEditForm({
                    ...editForm,
                    teamBDeclarations:
                      Number(editForm.teamBDeclarations || 0) + value
                  })
                }
                onRemove={(value) =>
                  setEditForm({
                    ...editForm,
                    teamBDeclarations: Math.max(
                      0,
                      Number(editForm.teamBDeclarations || 0) - value
                    )
                  })
                }
                onClear={() =>
                  setEditForm({ ...editForm, teamBDeclarations: 0 })
                }
              />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => toggleEditBela("A")}
                className={`rounded-2xl border p-5 text-left font-black transition ${
                  editForm.teamABela
                    ? "border-[var(--gold-light)] bg-[var(--gold)] text-[#0f2f24]"
                    : "border-[rgba(212,176,106,0.2)] bg-[rgba(10,32,24,0.75)] text-[var(--gold-light)]"
                }`}
              >
                Bela - {match.team_a_name}
              </button>

              <button
                type="button"
                onClick={() => toggleEditBela("B")}
                className={`rounded-2xl border p-5 text-left font-black transition ${
                  editForm.teamBBela
                    ? "border-[var(--gold-light)] bg-[var(--gold)] text-[#0f2f24]"
                    : "border-[rgba(212,176,106,0.2)] bg-[rgba(10,32,24,0.75)] text-[var(--gold-light)]"
                }`}
              >
                Bela - {match.team_b_name}
              </button>
            </div>

            <div className="card-soft mt-6">
              <h3 className="text-xl font-black text-[var(--gold-light)]">
                Novi obračun
              </h3>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <PreviewBox title="Bodovi A" value={editPreview.rawA} />
                <PreviewBox title="Bodovi B" value={editPreview.rawB} />
                <PreviewBox title="Zvanja A" value={editPreview.declarationsA} />
                <PreviewBox title="Zvanja B" value={editPreview.declarationsB} />
                <PreviewBox title="Bela A" value={editPreview.belaA} />
                <PreviewBox title="Bela B" value={editPreview.belaB} />
                <PreviewBox title="Ukupno A" value={editPreview.finalA} />
                <PreviewBox title="Ukupno B" value={editPreview.finalB} />
              </div>
            </div>

            <div className="mt-6">
              <Field label="Napomena">
                <textarea
                  value={editForm.note}
                  onChange={(event) =>
                    setEditForm({ ...editForm, note: event.target.value })
                  }
                  className="input min-h-24"
                />
              </Field>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary py-4 text-lg disabled:opacity-50"
              >
                {saving ? "Spremam..." : "Spremi promjene"}
              </button>

              <button
                type="button"
                onClick={closeEditGame}
                className="btn-outline py-4 text-lg"
              >
                Odustani
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function ScoreInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-2xl border border-[rgba(212,176,106,0.15)] bg-[rgba(10,32,24,0.7)] p-4">
      <span className="block text-sm font-black text-[var(--gold)]">
        {label}
      </span>

      <input
        type="text"
        value={value}
        onChange={(event) => {
          const onlyNumbers = event.target.value.replace(/\D/g, "");
          const numberValue = Math.min(162, Number(onlyNumbers || 0));

          onChange(onlyNumbers === "" ? "" : String(numberValue));
        }}
        className="no-spinner mt-3 w-full rounded-2xl border border-[rgba(212,176,106,0.15)] bg-[rgba(5,22,15,0.85)] px-4 py-5 text-center text-5xl font-black text-[var(--gold-light)] outline-none focus:border-[var(--gold)]"
        placeholder="0"
        inputMode="numeric"
        pattern="[0-9]*"
      />
    </label>
  );
}

function AutoScoreBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="block rounded-2xl border border-[rgba(212,176,106,0.15)] bg-[rgba(10,32,24,0.45)] p-4 opacity-95">
      <span className="block text-sm font-black text-[var(--gold)]">
        {label}
      </span>

      <div className="mt-3 w-full rounded-2xl border border-[rgba(212,176,106,0.08)] bg-[rgba(5,22,15,0.55)] px-4 py-5 text-center text-5xl font-black text-[var(--gold-light)]">
        {value}
      </div>

      <p className="mt-3 text-center text-xs font-bold text-white/45">
        Automatski: 162 - bodovi prve ekipe
      </p>
    </div>
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

function EditDeclarationsCard({
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
  return (
    <DeclarationsCard
      teamName={teamName}
      value={value}
      onAdd={onAdd}
      onRemove={onRemove}
      onClear={onClear}
    />
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
    <div className="rounded-2xl border border-[rgba(212,176,106,0.15)] bg-[rgba(10,32,24,0.8)] p-4 md:p-5">
      <p className="truncate text-xs text-white/55 sm:text-sm">{title}</p>
      <p className="mt-2 text-3xl font-black text-[var(--gold-light)] sm:text-4xl">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 truncate text-xs text-white/40 sm:text-sm">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function PreviewBox({ title, value }: { title: string; value: any }) {
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