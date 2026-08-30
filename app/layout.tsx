import "./globals.css";
import Link from "next/link";
export const metadata = { title: "Masquerade V7", description: "A daily multiplayer thinking game." };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body><div className="shell">
    <header className="topbar"><Link href="/" className="brand"><i/>Masquerade</Link><Link href="/profile">◎</Link></header>
    {children}
    <nav className="nav">
      <Link href="/">Today</Link><Link href="/challenge">Challenge</Link><Link href="/crew">Crew</Link><Link href="/stats">Stats</Link><Link href="/profile">Profile</Link>
    </nav>
  </div></body></html>
}
