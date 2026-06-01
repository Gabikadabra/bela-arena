"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PovijestPage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinishedTournaments();

    const channel = supabase
      .channel("povijest-turnira-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => loadFinishedTournaments(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadFinishedTournaments(showLoader = true) {
    if (showLoader) setLoading(true);

    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .order("starts_at", { ascending: false });

    setTournaments(data || []);
    setLoading(false);
  }

  function formatDate(value?: string | null) {
    if (!value) return "Nije uneseno";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("hr-HR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function formatType(type: string) {
    if (type === "knockout") return "Knockout";
    if (type === "groups_knockout") return "Grupe + knockout";
    if (type === "round_robin") return "Round robin";
    return type || "Nije definirano";
  }

  return (
    <main className="page">
      <section className="hero-card">
        <span className="badge">Arhiva</span>

        <h1 className="page-title mt-4">Povijest turnira</h1>

        <p className="muted mt-4 max-w-2xl">
          Ovdje se prikazuju samo završeni turniri. Aktivni i otvoreni turniri ostaju na tabu Turniri.
        </p>
      </section>

      {loading && <p className="muted mt-8">Učitavam povijest...</p>}

      {!loading && tournaments.length === 0 && (
        <section className="card mt-8">
          <p className="muted">Još nema završenih turnira.</p>
        </section>
      )}

      <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {tournaments.map((tournament) => (
          <article key={tournament.id} className="card-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-block rounded-full bg-zinc-500/20 px-3 py-1 text-xs font-black uppercase tracking-widest text-zinc-300">
                  Završeno
                </span>

                <h2 className="mt-4 text-2xl font-black text-[#f3dfad]">
                  {tournament.name || "Turnir bez naziva"}
                </h2>
              </div>

              <div className="rounded-2xl bg-[#d4b06a] px-4 py-3 text-center font-black text-black">
                {tournament.score_limit || 1001}
              </div>
            </div>

            <div className="mt-5 space-y-2 text-sm text-zinc-300">
              <p>
                <b className="text-[#d4b06a]">Lokacija:</b> {tournament.location || "Nije uneseno"}
              </p>
              <p>
                <b className="text-[#d4b06a]">Datum:</b> {formatDate(tournament.starts_at)}
              </p>
              <p>
                <b className="text-[#d4b06a]">Završeno:</b> {formatDate(tournament.finished_at)}
              </p>
              <p>
                <b className="text-[#d4b06a]">Sustav:</b> {formatType(tournament.tournament_format)}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a href={`/tournament/${tournament.id}`} className="btn-outline">
                Bracket
              </a>

              <a href={`/liga/${tournament.id}`} className="btn-outline">
                Liga prikaz
              </a>

              <a href={`/dashboard/${tournament.id}`} className="btn-outline">
                TV dashboard
              </a>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
