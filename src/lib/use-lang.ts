'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Lang } from './types';

const KEY = 'podlink_lang';

export function useLang(fallback: Lang): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>(fallback);
  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY) as Lang | null;
      if (s === 'hi' || s === 'mr' || s === 'en') setLang(s);
    } catch { /* private mode */ }
    const on = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('podlink-lang', on);
    return () => window.removeEventListener('podlink-lang', on);
  }, []);
  const set = useCallback((l: Lang) => {
    setLang(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('podlink-lang', { detail: l }));
  }, []);
  return [lang, set];
}
