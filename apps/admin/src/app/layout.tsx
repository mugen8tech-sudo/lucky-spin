import './globals.css';
import Link from 'next/link';
import AdminKeyBar from '../components/AdminKeyBar';

export const metadata = {
  title: 'Lucky Spin — Admin',
  description: 'Admin panel for vouchers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <div className="container">
          <header className="header">
            <Link href="/" style={{fontWeight:700}}>Lucky Spin Admin</Link>
            <nav className="nav">
              <Link href="/members">Member & Voucher</Link>
              <Link href="/vouchers">Riwayat Voucher</Link>
              <Link href="/health">Health</Link>
            </nav>
          </header>
          <AdminKeyBar />
          {children}
        </div>
      </body>
    </html>
  );
}
