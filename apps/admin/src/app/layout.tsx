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
        background: '#0f172a', /* slate-900 */
        color: '#e2e8f0'       /* slate-200 */
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
