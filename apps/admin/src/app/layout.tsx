import Link from 'next/link';
import AdminKeyBar from '../components/AdminKeyBar';

export const metadata = {
  title: 'Lucky Spin — Admin',
  description: 'Admin panel for vouchers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body style={{
        margin: 0,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
        background: '#0f172a',
        color: '#e2e8f0'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
          <header style={{display:'flex', gap:16, alignItems:'center', marginBottom:12}}>
            <Link href="/" style={{fontWeight:700}}>Lucky Spin Admin</Link>
            <nav style={{display:'flex', gap:12}}>
              <Link href="/members">Member & Voucher</Link>
              <Link href="/vouchers">Riwayat Voucher</Link>
            </nav>
          </header>
          <AdminKeyBar />
          {children}
        </div>
      </body>
    </html>
  );
}
