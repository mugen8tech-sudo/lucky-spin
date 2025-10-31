import Link from 'next/link';

export default function Page() {
  return (
    <main>
      <h1>Dashboard</h1>
      <ul style={{marginTop:12, lineHeight:2}}>
        <li><Link href="/members">Daftarkan Member & Generate Voucher</Link></li>
        <li><Link href="/vouchers">Riwayat Voucher & Proses</Link></li>
        <li><Link href="/denominations">Allowed Denominations (Cash & Dummy)</Link></li>
      </ul>
    </main>
  );
}
