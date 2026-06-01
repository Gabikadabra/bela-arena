"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { mainNavLinks } from "@/config/navigation";
import BelaLogo from "@/components/brand/BelaLogo";

const icons: Record<string, string> = {
  "/": "♟",
  "/turniri": "🏆",
  "/prijava": "＋",
  "/rang-lista": "♜",
  "/povijest": "☰",
  "/moj-racun": "♙",
  "/admin": "⚙"
};

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <aside className="app-sidebar hidden lg:flex">
        <Link href="/" className="app-sidebar-logo" aria-label="Bela Arena početna">
          <BelaLogo compact />
        </Link>

        <nav className="app-sidebar-links" aria-label="Glavna navigacija">
          {mainNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`app-sidebar-link ${isActive(link.href) ? "is-active" : ""}`}
              title={link.label}
            >
              <span className="app-sidebar-icon">{icons[link.href] || "•"}</span>
              <span className="app-sidebar-label">{link.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <header className="app-mobile-top lg:hidden">
        <Link href="/" onClick={() => setOpen(false)} aria-label="Bela Arena početna">
          <BelaLogo />
        </Link>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="app-mobile-menu-button"
          aria-label={open ? "Zatvori meni" : "Otvori meni"}
          aria-expanded={open}
        >
          <span className="relative h-5 w-6">
            <span className={`absolute left-0 top-0 h-0.5 w-6 rounded-full bg-current transition ${open ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`absolute left-0 top-2 h-0.5 w-6 rounded-full bg-current transition ${open ? "opacity-0" : ""}`} />
            <span className={`absolute left-0 top-4 h-0.5 w-6 rounded-full bg-current transition ${open ? "-translate-y-2 -rotate-45" : ""}`} />
          </span>
        </button>
      </header>

      {open && (
        <div className="app-mobile-menu lg:hidden">
          {mainNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`app-mobile-menu-link ${isActive(link.href) ? "is-active" : ""}`}
            >
              <span>{icons[link.href] || "•"}</span>
              <span>{link.label}</span>
              <span className="ml-auto">›</span>
            </Link>
          ))}
        </div>
      )}

      <nav className="app-bottom-nav lg:hidden" aria-label="Brza navigacija">
        {mainNavLinks.slice(0, 5).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`app-bottom-link ${isActive(link.href) ? "is-active" : ""}`}
          >
            <span>{icons[link.href] || "•"}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
