import BelaLogo from "@/components/brand/BelaLogo";

const highlights = [
  { label: "Live rezultati", value: "1 min refresh" },
  { label: "Format", value: "Liga + knockout" },
  { label: "Statistika", value: "ELO i zvanja" }
];

export default function Home() {
  return (
    <main>
      <section className="page">
        <div className="hero-card grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="relative z-10">
            <div className="mb-6 inline-flex">
              <BelaLogo />
            </div>

            <p className="badge mb-5">Bela turniri bez kaosa po papirima</p>

            <h1 className="max-w-4xl text-4xl font-black leading-[0.95] tracking-[-0.05em] text-white sm:text-5xl md:text-7xl">
              Bela Arena za ždrijeb, rezultate i rang listu.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Simple sučelje, osjećaj pravog turnira i sve važne stvari na jednom mjestu:
              prijave ekipa, live mečevi, povijest, zvanja, liga, grupe i knockout.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a href="/turniri" className="btn-primary">
                Pogledaj turnire
              </a>

              <a href="/prijava" className="btn-outline">
                Prijavi ekipu
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {highlights.map((item) => (
                <div key={item.label} className="stat-card">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d4b06a]/70">{item.label}</p>
                  <p className="mt-2 text-xl font-black text-[#f3dfad]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10">
            <div className="playing-card min-h-[360px] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.24em] text-[#d4b06a]/70">Finale uživo</p>
                  <h2 className="mt-2 text-3xl font-black text-[#f3dfad]">Partija do 1001</h2>
                </div>
                <div className="rounded-2xl bg-red-500/15 px-4 py-2 text-sm font-black text-red-200">LIVE</div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="rounded-2xl border border-[#d4b06a]/20 bg-[#071810]/55 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-lg font-black">Kumovi</span>
                    <span className="text-4xl font-black text-[#f3dfad]">1001</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#d4b06a]/15">
                    <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#d4b06a] to-[#f3dfad]" />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#071810]/35 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-lg font-black">Asovi</span>
                    <span className="text-4xl font-black text-white">842</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[84%] rounded-full bg-white/30" />
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-400/10 p-4 text-sm font-bold text-green-200">
                Rezultati se automatski osvježavaju na live stranicama.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
