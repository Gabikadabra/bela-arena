export default function Home() {
  return (
    <main>
      <section className="page">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-[#d4b06a]/30 bg-[#d4b06a]/10 px-4 py-2 text-sm text-[#d4b06a]">
              Igraj belu kao pravi profesionalac
            </p>

            <h1 className="max-w-4xl text-4xl font-black leading-tight sm:text-5xl md:text-7xl">
              Zaigraj belu, prati rezultate i osvoji vrh ljestvice.
            </h1>

            <p className="mt-6 max-w-2xl text-lg text-zinc-300">
              Bela Arena je mjesto gdje igrači prijavljuju ekipe, natječu se na turnirima,
              prate live rezultate, ždrijeb i povijest svojih mečeva.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="/turniri"
                className="btn-primary transition hover:bg-[#f3dfad]"
              >
                Zaigraj odmah
              </a>

              <a
                href="/rang-lista"
                className="btn-outline transition hover:bg-[#d4b06a]/10"
              >
                Rang lista
              </a>
            </div>
          </div>

          <div className="card-glow rounded-3xl border border-[#d4b06a]/20 bg-[#184332]/85 p-6">
            <div className="rounded-2xl bg-[#12392b] p-5">
              <p className="text-sm text-zinc-400">Finale</p>

              <div className="mt-4 space-y-3">
                <div className="flex justify-between rounded-xl bg-[#0a2018]/40 p-4">
                  <span>Kumovi</span>
                  <b className="text-[#f3dfad]">1001</b>
                </div>

                <div className="flex justify-between rounded-xl bg-[#0a2018]/40 p-4">
                  <span>Asovi</span>
                  <b>842</b>
                </div>
              </div>

              <p className="mt-5 text-sm text-green-400">
                Meč završen · pobjednik Kumovi 🏆
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}