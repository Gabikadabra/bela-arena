"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function OdaberiTurnirZaUredjivanjePage() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTournaments();
  }, []);

  async function loadTournaments() {
    setLoading(true);

    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("starts_at", { ascending: false });

    if (!error) {
      setTournaments(data || []);
    }

    setLoading(false);
  }

  return (
    <main className="page">
      <section className="hero-card">
        <span className="badge">Admin</span>

        <h1 className="page-title mt-4">Uredi turnir</h1>

        <p className="muted mt-4 max-w-2xl">
          Odaberi turnir kojem želiš promijeniti podatke, status, limite bodova ili format meča.
        </p>
      </section>

      <section className="card mt-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="section-title">Turniri</h2>
            <p className="muted mt-2">Svi kreirani turniri dostupni za uređivanje.</p>
          </div>

          <a href="/admin" className="btn-outline">Admin panel</a>
        </div>

        {loading && <p className="muted mt-6">Učitavanje turnira...</p>}

        {!loading && tournaments.length === 0 && (
          <div className="card-soft mt-6">
            <p className="muted">Nema kreiranih turnira.</p>
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tournaments.map((tournament) => (
            <div key={tournament.id} className="card-soft">
              <p className="text-xs font-black uppercase tracking-widest text-[#d4b06a]">
                Turnir
              </p>

              <h3 className="mt-2 text-2xl font-black text-[#f3dfad]">
                {tournament.name || "Turnir bez naziva"}
              </h3>

              <div className="mt-4 space-y-1 text-sm text-white/65">
                {tournament.location && <p>Lokacija: {tournament.location}</p>}
                {tournament.starts_at && (
                  <p>Datum: {new Date(tournament.starts_at).toLocaleDateString("hr-HR")}</p>
                )}
                {tournament.status && <p>Status: {tournament.status}</p>}
                <p>Grupe do: {tournament.group_score_limit || tournament.score_limit || 701}</p>
                <p>Knockout do: {tournament.knockout_score_limit || tournament.score_limit || 1001}</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <a href={`/admin/uredi-turnir/${tournament.id}`} className="btn-primary">
                  Uredi
                </a>

                <a href={`/admin/zdrijeb`} className="btn-outline">
                  Ždrijeb
                </a>

                <a href={`/tournament/${tournament.id}`} className="btn-outline">
                  Pogledaj
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
