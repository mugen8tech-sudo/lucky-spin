'use client';

const CANDIDATES = ['admin-key', 'ADMIN_KEY', 'x-admin-key'];

export function getAdminKey(): string {
  for (const k of CANDIDATES) {
    const v = typeof window !== 'undefined' ? localStorage.getItem(k) : null;
    if (v) return v;
  }
  return '';
}

export const SUPER_KEY_LS = 'super-key';

export function getSuperKey(): string {
  return typeof window !== 'undefined' ? (localStorage.getItem(SUPER_KEY_LS) ?? '') : '';
}

export function adminHeaders(extra?: Record<string,string>): HeadersInit {
  const h: Record<string,string> = { 'x-admin-key': getAdminKey() };
  const sk = getSuperKey();
  if (sk) h['x-super-key'] = sk;
  return { ...(extra || {}), ...h };
}
