'use client';
import { Header } from '@/components/chrome';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-shell">
      <Header />
      <main className="state-card">
        <h1>A small interruption.</h1>
        <p>Your accepted guesses are saved. Let’s get you back to your room.</p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </main>
    </div>
  );
}
