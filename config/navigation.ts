export type NavLink = {
  href: string;
  label: string;
};

export const mainNavLinks: NavLink[] = [
  { href: "/", label: "Početna" },
  { href: "/turniri", label: "Turniri" },
  { href: "/prijava", label: "Prijava" },
  { href: "/rang-lista", label: "Rang lista" },
  { href: "/povijest", label: "Povijest" },
  { href: "/moj-racun", label: "Moj račun" },
  { href: "/admin", label: "Admin" }
];
