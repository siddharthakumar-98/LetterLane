import Link from 'next/link';
import { Header, Footer } from './chrome';
import { SITE_LINKS } from '@/lib/site-links';

/** Shared shell for the readable pages: rules, about, FAQ and privacy. */
export function ContentPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="page-shell">
      <Header markCurrent={false} />
      <main className="content-page">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="content-intro">{intro}</p>
        {children}
        <nav className="content-next" aria-label="Keep reading">
          <Link href="/" className="button primary">
            Play Words
          </Link>
          <Link href="/phrases" className="button secondary">
            Play Phrases
          </Link>
          {SITE_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="text-button">
              {label}
            </Link>
          ))}
        </nav>
      </main>
      <Footer />
    </div>
  );
}
