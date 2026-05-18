"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Početna" },
  { href: "/turniri", label: "Turniri" },
  { href: "/prijava", label: "Prijava" },
  { href: "/rang-lista", label: "Rang lista" },
  { href: "/povijest", label: "Povijest" },
  { href: "/moj-racun", label: "Moj račun" },
  { href: "/admin", label: "Admin" }
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-yellow-500/10 bg-black/75 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-3" onClick={() => setOpen(false)}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-yellow-500/30 bg-yellow-500/10 text-xl font-black text-yellow-300 shadow-[0_0_25px_rgba(250,204,21,0.12)] transition group-hover:scale-105">
            BA
          </div>

          <div className="leading-tight">
            <p className="text-lg font-black text-yellow-400">Bela Arena</p>
            <p className="hidden text-xs font-bold uppercase tracking-[0.22em] text-zinc-500 sm:block">
              Turnir platforma
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-2 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                isActive(link.href)
                  ? "bg-yellow-400 text-black shadow-[0_0_24px_rgba(250,204,21,0.16)]"
                  : "text-zinc-300 hover:bg-yellow-500/10 hover:text-yellow-300"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 transition hover:bg-yellow-500/20 lg:hidden"
          aria-label={open ? "Zatvori meni" : "Otvori meni"}
          aria-expanded={open}
        >
          <span className="relative h-5 w-6">
            <span
              className={`absolute left-0 top-0 h-0.5 w-6 rounded-full bg-current transition ${
                open ? "translate-y-2 rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-2 h-0.5 w-6 rounded-full bg-current transition ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-4 h-0.5 w-6 rounded-full bg-current transition ${
                open ? "-translate-y-2 -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </nav>

      {open && (
        <div className="border-t border-yellow-500/10 bg-zinc-950/98 px-4 pb-5 pt-3 shadow-2xl lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between rounded-2xl border px-4 py-4 text-base font-black transition ${
                  isActive(link.href)
                    ? "border-yellow-400/50 bg-yellow-400 text-black"
                    : "border-white/10 bg-black/30 text-zinc-200 hover:border-yellow-500/30 hover:bg-yellow-500/10 hover:text-yellow-300"
                }`}
              >
                <span>{link.label}</span>
                <span className="text-lg">›</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
