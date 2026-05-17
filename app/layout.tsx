import "./globals.css";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Bela Arena",
  description: "Platforma za organizaciju turnira u beli"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
