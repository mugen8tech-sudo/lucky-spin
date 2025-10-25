export const metadata = {
  title: 'Lucky Spin — Member',
  description: 'Enter voucher code and spin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body style={{
        margin: 0,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
        background: '#020617', /* slate-950 */
        color: '#e2e8f0'
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
