import "./globals.css";
import Nav from "@/components/layout/AppNav";

export const metadata = {
  title: "Bela Arena",
  description: "Platforma za organizaciju turnira u beli"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <body>
        <div className="bela-bg-effects" aria-hidden="true" />
        <Nav />
        {children}
      </body>
    </html>
  );
}
