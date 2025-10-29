import './globals.css';

export const metadata = {
  title: 'Lucky Wheel',
  description: 'Masukkan kode dan putar roda keberuntungan!',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
