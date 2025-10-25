'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'adminKey';

export function useAdminKey() {
  const [key, setKeyState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const k = localStorage.getItem(STORAGE_KEY);
      setKeyState(k);
    } catch {}
    setReady(true);
  }, []);

  const setKey = (k: string | null) => {
    if (k) localStorage.setItem(STORAGE_KEY, k);
    else localStorage.removeItem(STORAGE_KEY);
    setKeyState(k);
  };

  // 👉 Pastikan selalu Record<string,string>
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['x-admin-key'] = key;

  return { key, setKey, ready, headers };
}
