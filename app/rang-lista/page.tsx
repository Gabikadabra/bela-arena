export default function RangListaPage() {
  const teams = [[1,"Kumovi",1840],[2,"Asovi",1762],[3,"Ä‚â€žĂ„â€¦Ä‚â€šĂ‚Â mekeri",1699]];
  return <main className="mx-auto max-w-5xl px-6 py-12"><h1 className="text-4xl font-black text-yellow-400">Rang lista</h1><div className="mt-8 overflow-hidden rounded-2xl border border-white/10">{teams.map(t=><div key={t[0]} className="grid grid-cols-3 border-b border-white/10 bg-zinc-950 p-4"><b>#{t[0]}</b><span>{t[1]}</span><b className="text-yellow-400">{t[2]}</b></div>)}</div></main>
}
