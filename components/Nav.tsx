export default function Nav() {
  const links = [
    ["/", "Početna"],
    ["/turniri", "Turniri"],
    ["/rang-lista", "Rang lista"],
    ["/povijest", "Povijest"],
    ["/registracija", "Registracija"],
    ["/login", "Login"],
    ["/moj-racun", "Moj račun"],
    ["/admin", "Admin"]
    
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-yellow-500/30 bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="/" className="text-2xl font-black tracking-tight text-yellow-400">Bela Arena</a>
        <div className="hidden gap-5 text-sm text-zinc-200 md:flex">
          {links.map(([href, label]) => <a key={href} href={href} className="transition hover:text-yellow-400">{label}</a>)}
        </div>
      </div>
    </nav>
  )
}
