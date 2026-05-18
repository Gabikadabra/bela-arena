export default function Home() {
  return (
    <main className="page">
      <section className="hero-card">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="badge">
              Igraj belu kao pravi profesionalac
            </p>

            <h1 className="page-title max-w-4xl">
              Zaigraj belu, prati rezultate i osvoji vrh ljestvice.
            </h1>

            <p className="mt-6 max-w-2xl text-lg text-zinc-300">
              Bela Arena je mjesto gdje igrači prijavljuju ekipe, natječu se na turnirima,
              prate live rezultate, ždrijeb i povijest svojih mečeva.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="/turniri"
                className="btn-primary"
              >
                Zaigraj odmah
              </a>

              <a
                href="/rang-lista"
                className="btn-outline"
              >
                Rang lista
              </a>
            </div>
          </div>

          <div className="card-glow card">
            <div className="item-card">
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