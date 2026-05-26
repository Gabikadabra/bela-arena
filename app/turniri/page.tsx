"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TurniriPage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTournaments();
  }, []);

  async function loadTournaments() {
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .order("starts_at", { ascending: true });

    setTournaments(data || []);
    setLoading(false);
  }

  function formatType(type: string) {
    if (type === "knockout") return "Knockout";
    if (type === "groups_knockout") return "Grupe + knockout";
    if (type === "round_robin") return "Round robin";
    return type || "Nije definirano";
  }

  function formatMatch(format: string) {
    if (format === "best_of_1") return "Jedna partija";
    if (format === "best_of_3") return "Do 2 pobjede";
    if (format === "best_of_5") return "Do 3 pobjede";
    return format || "Nije definirano";
  }

  return (
    <main className="page">
      <div className="mb-10">
        <p className="mb-4 inline-block rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
          Bela Arena
        </p>

        <h1 className="text-4xl font-black text-[#f3dfad] sm:text-5xl">
          Turniri
        </h1>

        <p className="mt-4 max-w-2xl text-zinc-300">
          Pogledaj sve turnire, pravila, prijave, ždrijeb i live rezultate.
        </p>
      </div>

      {loading && <p className="text-zinc-300">Učitavam turnire...</p>}

      {!loading && tournaments.length === 0 && (
        <div className="rounded-3xl border border-[#d4b06a]/15 bg-[#0a2018] p-8 text-zinc-300">
          Trenutno nema kreiranih turnira.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {tournaments.map((tournament) => (
          <article
            key={tournament.id}
            className="rounded-3xl border border-[#d4b06a]/15 bg-[#184332]/85 p-6 shadow-2xl transition hover:border-[#f3dfad]/60"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                    tournament.status === "open"
                      ? "bg-green-500/20 text-green-300"
                      : "bg-[#21503d] text-zinc-300"
                  }`}
                >
                  {tournament.status || "unknown"}
                </span>

                <h2 className="mt-4 text-2xl font-black text-[#f3dfad] sm:text-3xl">
                  {tournament.name}
                </h2>
              </div>

              <div className="rounded-2xl bg-[#d4b06a] px-4 py-3 text-center font-black text-black">
                {tournament.score_limit || 1001}
              </div>
            </div>

            <div className="mt-5 space-y-2 text-zinc-300">
              <p>
                <b className="text-[#d4b06a]">Lokacija:</b>{" "}
                {tournament.location || "Nije uneseno"}
              </p>

              <p>
                <b className="text-[#d4b06a]">Datum:</b>{" "}
                {tournament.starts_at || "Nije uneseno"}
              </p>

              <p>
                <b className="text-[#d4b06a]">Max ekipa:</b>{" "}
                {tournament.max_teams || "Nema limita"}
              </p>

              <p>
                <b className="text-[#d4b06a]">Kotizacija:</b>{" "}
                {tournament.entry_fee ? `${tournament.entry_fee} €` : "0 €"}
              </p>

              <p>
                <b className="text-[#d4b06a]">Sustav:</b>{" "}
                {formatType(tournament.tournament_format)}
              </p>

              <p>
                <b className="text-[#d4b06a]">Format meča:</b>{" "}
                {formatMatch(tournament.match_format)}
              </p>

              <p>
                <b className="text-[#d4b06a]">Repešaž:</b>{" "}
                {tournament.has_repechage ? "Da" : "Ne"}
              </p>
            </div>

            {tournament.rules && (
              <div className="mt-5 rounded-2xl bg-[#12392b] p-4 text-sm text-zinc-300">
                <b className="text-[#d4b06a]">Pravila:</b>
                <p className="mt-2">{tournament.rules}</p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {tournament.status === "open" && (
                <a
                  href="/prijava"
                  className="rounded-xl bg-[#d4b06a] px-5 py-3 font-bold text-black transition hover:bg-[#f3dfad]"
                >
                  Prijavi ekipu
                </a>
              )}

              <a
                href={`/tournament/${tournament.id}`}
                className="rounded-xl border border-[#d4b06a]/40 px-5 py-3 font-bold text-[#d4b06a] transition hover:bg-[#d4b06a]/10"
              >
                Bracket
              </a>

              
              
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}