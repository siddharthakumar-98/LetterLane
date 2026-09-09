import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="state-card">
      <h1>This lane leads nowhere.</h1>
      <p>Let’s find you a fresh word and a friend.</p>
      <Link className="button primary" href="/">
        Back to Letterlane
      </Link>
    </main>
  );
}
