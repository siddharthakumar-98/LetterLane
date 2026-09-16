'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  HeartHandshake,
  LockKeyhole,
  Sparkles,
  Swords,
} from 'lucide-react';
import { Header, Footer } from './chrome';
import { api, ApiError } from '@/lib/client/api';
import { codeSchema, nameSchema } from '@/lib/game/validation';
import type { Mode, RoomView, BotDifficulty } from '@/lib/game/types';
import { BOT_PROFILES } from '@/lib/game/bot-difficulty';
export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<Mode>('duel');
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function start(join: boolean) {
    setError('');
    const parsedName = nameSchema.safeParse(name);
    if (!parsedName.success) {
      setError(parsedName.error.issues[0].message);
      return;
    }
    const parsedCode = codeSchema.safeParse(code);
    if (join && !parsedCode.success) {
      setError(parsedCode.error.issues[0].message);
      return;
    }
    setBusy(join ? 'join' : 'create');
    try {
      const room = await api<RoomView>(
        join ? `/api/rooms/${parsedCode.data}` : '/api/rooms',
        join
          ? { type: 'join', name: parsedName.data }
          : { name: parsedName.data, mode, botDifficulty },
      );
      localStorage.setItem('letterlane-name', parsedName.data);
      router.push(`/room/${room.code}`);
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : 'We could not connect. Check your connection and try again.',
      );
      setBusy('');
    }
  }
  return (
    <div className="page-shell">
      <Header />
      <main className="home-main">
        <section className="start-panel" aria-labelledby="home-title">
          <h1 id="home-title">
            Two minds.
            <br />
            <span>One word.</span>
          </h1>
          <section className="home-preview" aria-label="An example round">
            <div className="preview-topline">
              <span className="eyebrow">A GOOD KIND OF COMPETITION</span>
              <Sparkles size={20} />
            </div>
            <div className="preview-game">
              <div className="preview-player">
                <div className="avatar sky">Y</div>
                <div>
                  <strong>You</strong>
                  <span>A hunch, then a breakthrough.</span>
                </div>
                <span className="player-tag">YOUR LANE</span>
              </div>
              <div
                className="preview-tiles"
                aria-label="Example: guesses SLATE, CHIME, CHARM"
              >
                {[
                  {
                    word: 'SLATE',
                    marks: ['absent', 'absent', 'correct', 'absent', 'absent'],
                  },
                  {
                    word: 'CHIME',
                    marks: [
                      'correct',
                      'correct',
                      'absent',
                      'present',
                      'absent',
                    ],
                  },
                  {
                    word: 'CHARM',
                    marks: [
                      'correct',
                      'correct',
                      'correct',
                      'correct',
                      'correct',
                    ],
                  },
                ].map((row, i) => (
                  <div className="tile-row" key={row.word}>
                    {[...row.word].map((letter, j) => (
                      <span
                        className={`tile ${row.marks[j]} ${i === 2 ? 'preview-win' : ''}`}
                        key={j}
                      >
                        {letter}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <div className="preview-result">
                <span className="win-spark">✦</span>
                <span>
                  That <em>“I got it!”</em> feeling.
                </span>
                <span>3 / 6</span>
              </div>
            </div>
            <div className="three-facts">
              <div>
                <strong>05</strong>
                <span>letters to find</span>
              </div>
              <div>
                <strong>06</strong>
                <span>chances each</span>
              </div>
              <div>
                <Copy size={24} />
                <span>one link to play</span>
              </div>
            </div>
          </section>
          <p className="home-description">
            A friendly rivalry. A shared little victory.
            <br />
            Your next five-letter obsession starts here.
          </p>
          <form
            className="start-form"
            onSubmit={(event) => {
              event.preventDefault();
              void start(false);
            }}
          >
            <label className="field-label" htmlFor="display-name">
              What should we call you?
            </label>
            <input
              id="display-name"
              placeholder="Your display name"
              autoComplete="nickname"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!busy}
            />
            <fieldset className="mode-picker">
              <legend>Pick your kind of wordplay</legend>
              <label className={mode === 'duel' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="mode"
                  value="duel"
                  checked={mode === 'duel'}
                  onChange={() => setMode('duel')}
                />
                <Swords size={21} />
                <span>
                  <strong>Head to head</strong>
                  <small>Race to the answer</small>
                </span>
                {mode === 'duel' && <Check className="mode-check" size={16} />}
              </label>
              <label className={mode === 'coop' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="mode"
                  value="coop"
                  checked={mode === 'coop'}
                  onChange={() => setMode('coop')}
                />
                <HeartHandshake size={21} />
                <span>
                  <strong>Better together</strong>
                  <small>Solve as a team</small>
                </span>
                {mode === 'coop' && <Check className="mode-check" size={16} />}
              </label>
            </fieldset>
            <fieldset
              className="difficulty-picker"
              disabled={!!busy}
              aria-describedby="difficulty-help"
            >
              <legend>Bot difficulty</legend>
              <p id="difficulty-help">
                If no friend joins, choose who fills the open seat.
              </p>
              <div className="difficulty-options">
                {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
                  <label
                    key={difficulty}
                    className={botDifficulty === difficulty ? 'selected' : ''}
                  >
                    <input
                      type="radio"
                      name="bot-difficulty"
                      value={difficulty}
                      checked={botDifficulty === difficulty}
                      onChange={() => setBotDifficulty(difficulty)}
                    />
                    <span>
                      <strong>{BOT_PROFILES[difficulty].label}</strong>
                      <small>{BOT_PROFILES[difficulty].name}</small>
                    </span>
                  </label>
                ))}
              </div>
              <p>{BOT_PROFILES[botDifficulty].description}</p>
            </fieldset>
            <button
              className="button primary full"
              disabled={!!busy}
              type="submit"
            >
              {busy === 'create'
                ? 'Making room for two…'
                : 'Create a private room'}
              <ArrowUpRight size={21} />
            </button>
          </form>
          <form
            className="join-form"
            onSubmit={(event) => {
              event.preventDefault();
              void start(true);
            }}
          >
            <label htmlFor="room-code">Have an invite?</label>
            <div>
              <input
                id="room-code"
                aria-label="Room code"
                placeholder="ROOM CODE"
                maxLength={6}
                autoCapitalize="characters"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={!!busy}
              />
              <button
                className="button secondary"
                disabled={!!busy}
                type="submit"
              >
                {busy === 'join' ? 'Joining…' : 'Join'}
                <ArrowRight size={17} />
              </button>
            </div>
          </form>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <p className="privacy-note">
            <LockKeyhole size={13} /> Just you and your friend. No account
            needed.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
