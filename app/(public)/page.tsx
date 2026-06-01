import BelaLogo from "@/components/brand/BelaLogo";

const highlights = [
  { label: "Aktivni turniri", value: "Brzo" },
  { label: "Live rezultati", value: "Auto refresh" },
  { label: "Rang lista", value: "ELO + zvanja" },
  { label: "Format", value: "Liga / knockout" }
];

export default function Home() {
  return (
    <main>
      <section className="page">
        <div className="chess-hero">
          <div className="hero-card">
            <div className="relative z-10">
              <div className="mb-7 inline-flex">
                <BelaLogo />
              </div>

              <p className="badge mb-5">Turnirska bela bez kaosa</p>

              <h1 className="max-w-4xl text-4xl font-black leading-[0.96] tracking-[-0.05em] text-white sm:text-6xl md:text-7xl">
                Igraj belu kao ozbiljnu online arenu.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#d8cfc1]">
                Jednostavan dashboard, prijave ekipa, live rezultati, ždrijeb, liga, knockout,
                povijest i rang lista — sve složeno kao moderna turnirska aplikacija.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="/turniri" className="btn-primary">
                  Pogledaj turnire
                </a>

                <a href="/prijava" className="btn-outline">
                  Prijavi ekipu
                </a>
              </div>
            </div>
          </div>

          <div className="card p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="admin-panel-title">Live primjer</p>
                <h2 className="mt-1 text-2xl font-black">Finalni stol</h2>
              </div>
              <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-200">LIVE</span>
            </div>

            <div className="chess-board-preview" aria-hidden="true">
              {Array.from({ length: 16 }).map((_, index) => (
                <span key={index} />
              ))}
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-[#2a2825] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-black">Kumovi</span>
                  <span className="text-3xl font-black text-[#b7e286]">1001</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-black/25">
                  <div className="h-2 w-full rounded-full bg-[#81b64c]" />
                </div>
              </div>

              <div className="rounded-2xl bg-[#2a2825] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-black">Asovi</span>
                  <span className="text-3xl font-black">842</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-black/25">
                  <div className="h-2 w-[84%] rounded-full bg-[#eeeed2]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item) => (
            <div key={item.label} className="stat-card">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b9a78a]">{item.label}</p>
              <p className="mt-2 text-xl font-black text-[#f5f0e8]">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
