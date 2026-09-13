'use client';
import Link from 'next/link';
import Image from 'next/image';
import brandLogo from '@/app/icon.jpg';
import { useRef } from 'react';
import { ArrowUpRight, HelpCircle, X } from 'lucide-react';
export function Logo() {
  return (
    <Link href="/" aria-label="LetterLane home" className="logo">
      <Image src={brandLogo} alt="" className="logo-mark" sizes="56px" />
      LetterLane<span className="logo-period">.</span>
    </Link>
  );
}
export function HowToPlay() {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="text-button help-button"
        aria-label="How to play"
        onClick={() => ref.current?.showModal()}
      >
        <HelpCircle size={18} />
        <span>How to play</span>
      </button>
      <dialog ref={ref} className="how-dialog" aria-labelledby="how-title">
        <div className="dialog-heading">
          <span className="eyebrow">THE SHORT VERSION</span>
          <button
            className="icon-button"
            aria-label="Close instructions"
            onClick={() => ref.current?.close()}
          >
            <X />
          </button>
        </div>
        <h2 id="how-title">
          Five letters. Six chances.
          <br />A friend on the other side.
        </h2>
        <p>
          Find the same hidden word at the same time. Enter a five-letter word,
          then use the colors to narrow it down.
        </p>
        <div className="legend-list">
          <div>
            <span className="tile correct">L</span>
            <p>
              <strong>Right letter, right place.</strong>
              <br />
              Keep this one exactly where it is.
            </p>
          </div>
          <div>
            <span className="tile present">A</span>
            <p>
              <strong>Right letter, new place.</strong>
              <br />
              It belongs somewhere else.
            </p>
          </div>
          <div>
            <span className="tile absent">N</span>
            <p>
              <strong>No more of this letter.</strong>
              <br />
              Duplicates only count if the word has them.
            </p>
          </div>
        </div>
        <p>
          <strong>Duel:</strong> the first solver wins. Solves within 750 ms are
          compared by guesses used, then server-recorded time. If neither
          solves, we compare the most letters revealed in one guess, how early
          that score was reached, then exact positions and misplaced letters. An
          exact tie is a draw.
        </p>
        <p>
          <strong>Co-op:</strong> you each get six tries. If either of you
          solves it, you both win. Your friend’s letters stay hidden until the
          result in either mode.
        </p>
        <p>
          <strong>Playing solo?</strong> If no second player joins your room
          after 45 seconds, Pip, a clearly labeled bot, fills the open seat. It
          plays from its own clues and is always ready for a rematch.
        </p>
        <button
          className="button primary full"
          onClick={() => ref.current?.close()}
        >
          Got it. Let’s play <ArrowUpRight size={19} />
        </button>
      </dialog>
    </>
  );
}
export function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="site-header">
      <Logo />
      <nav aria-label="Main navigation">
        {children}
        <HowToPlay />
      </nav>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <span>A little friendly wordplay.</span>
      <span>
        2 players <span aria-hidden="true">/</span> 5 letters{' '}
        <span aria-hidden="true">/</span> endless rematches
      </span>
    </footer>
  );
}
