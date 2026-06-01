import "./globals.css";
import Nav from "@/components/layout/AppNav";

export const metadata = {
  title: "Bela Arena",
  description: "Platforma za organizaciju turnira u beli",
  icons: {
    icon: "/brand/bela-arena-logo.svg"
  },
  openGraph: {
    title: "Bela Arena",
    description: "Turniri u beli, live rezultati i rang lista.",
    images: ["/brand/bela-arena-logo.svg"]
  }
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
