'use client';
import { LANGS } from '@/lib/i18n';
import type { Lang } from '@/lib/types';

export function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div role="radiogroup" aria-label="Language" className="inline-flex rounded-xl border border-line bg-paper p-0.5">
      {LANGS.map((l) => (
        <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} onClick={() => onChange(l.code)}
          className={`min-w-11 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${lang === l.code ? 'bg-brand text-white' : 'text-ink-soft'}`}>{l.label}</button>
      ))}
    </div>
  );
}
