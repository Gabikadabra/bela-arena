export default function Home() {
  return (
    <main>
      <section className="page">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
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
                className="btn-primary transition hover:bg-yellow-300"
              >
                Zaigraj odmah
              </a>

              <a
                href="/rang-lista"
                className="btn-outline transition hover:bg-yellow-500/10"
              >
                Rang lista
              </a>
            </div>
          </div>

          <div className="card-glow rounded-3xl border border-yellow-500/20 bg-zinc-950/80 p-6">
            <div className="rounded-2xl bg-zinc-900 p-5">
              <p className="text-sm text-zinc-400">Finale</p>

              <div className="mt-4 space-y-3">
                <div className="flex justify-between rounded-xl bg-black/40 p-4">
                  <span>Kumovi</span>
                  <b className="text-yellow-400">1001</b>
                </div>

                <div className="flex justify-between rounded-xl bg-black/40 p-4">
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