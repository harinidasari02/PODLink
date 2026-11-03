'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, Logo } from './ui';

const TABS = [
  { href: '/billing', label: 'Dashboard' },
  { href: '/billing/review', label: 'Review' },
  { href: '/billing/queue', label: 'Billing' },
  { href: '/billing/import', label: 'Import' },
];

export function BillingNav({ name, reviewCount }: { name: string; reviewCount: number }) {
  const path = usePathname();
  const router = useRouter();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Logo />
        <nav className="-mb-px ml-2 flex flex-1 gap-1 overflow-x-auto text-sm font-medium" aria-label="Main">
          {TABS.map((t) => {
            const active = t.href === '/billing' ? path === '/billing' : path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${active ? 'bg-wash text-ink' : 'text-ink-soft hover:text-ink'}`}>
                {t.label}
                {t.href === '/billing/review' && reviewCount > 0 && <span className="ml-1.5 rounded-full bg-review px-1.5 py-0.5 text-[11px] font-semibold text-white">{reviewCount}</span>}
              </Link>
            );
          })}
        </nav>
        <span className="hidden text-sm text-ink-soft sm:block">{name}</span>
        <button className="btn-quiet !px-2.5" aria-label="Sign out" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.replace('/login'); }}><Icon name="logout" size={18} /></button>
      </div>
    </header>
  );
}
