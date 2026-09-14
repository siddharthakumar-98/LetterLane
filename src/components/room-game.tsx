'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  HeartHandshake,
  LockKeyhole,
  Radio,
  Share2,
  Swords,
  WifiOff,
} from 'lucide-react';
import { Header, Footer } from './chrome';
import { Board, MaskedBoard } from './board';
import { Keyboard } from './keyboard';
import { Results } from './results';
import { RoundTimer } from './round-timer';
import { INITIAL_TIME_MS, timeBonus } from '@/lib/game/round-clock';
import { useRoom } from '@/lib/client/use-room';
import type { PlayerView, RoomView } from '@/lib/game/types';
import { nameSchema } from '@/lib/game/validation';
import { BotNotice, BotTag } from './bot-notice';
function PlayerBadge({
  player,
  self,
  now,
}: {
  player?: PlayerView;
  self?: boolean;
  now: number;
}) {
  const online = player && (player.isBot || now - player.lastSeen < 15000);
  return (
    <div className={`player-badge ${self ? '' : 'opponent-badge'}`}>
      <div className={`avatar ${self ? 'sky' : 'periwinkle'}`}>
        {player ? player.name[0].toUpperCase() : '?'}
      </div>
      <div>
        <strong>
          {player?.name ?? 'Your friend'}
          {self && <span className="you-tag">YOU</span>}
          {player?.isBot && <BotTag />}
        </strong>
        <span className="player-status">
          <i className={online ? 'online' : ''} />
          {!player
            ? 'An open invitation'
            : player.isBot
              ? 'Bot · ready to play'
              : online
                ? player.ready
                  ? 'Ready to play'
                  : 'In the room'
                : 'Disconnected · waiting'}
        </span>
      </div>
    </div>
  );
}
function Lobby({
  room,
  now,
  busy,
  onReady,
  copied,
  onCopy,
}: {
  room: RoomView;
  now: number;
  busy: boolean;
  onReady: () => void;
  copied: boolean;
  onCopy: () => void;
}) {
  const me = room.players.find((p) => p.id === room.selfId)!;
  return (
    <section className="lobby">
      <div className="lobby-main">
        <div className="lobby-icon">
          {room.mode === 'duel' ? (
            <Swords size={28} />
          ) : (
            <HeartHandshake size={28} />
          )}
        </div>
        <span className="eyebrow">YOUR PRIVATE ROOM</span>
        <h1>
          {room.players.length === 1
            ? 'Save a seat for a friend.'
            : 'Two minds, all set?'}
        </h1>
        <p>
          {room.players.length === 1
            ? 'Send them the link. The good kind of rivalry is one click away.'
            : 'Take a breath. You’ll start together when you’re both ready.'}
        </p>
        <BotNotice room={room} now={now} />
        <button
          className="room-code-card"
          onClick={onCopy}
          aria-label="Copy invitation link"
        >
          <span>ROOM CODE</span>
          <strong>{room.code}</strong>
          <span className="copy-code">
            {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
            {copied ? 'Invite copied' : 'Copy invite link'}
          </span>
        </button>
        <div className="lobby-seats">
          {room.players.map((p) => (
            <div key={p.id}>
              <PlayerBadge player={p} self={p.id === room.selfId} now={now} />
              <span className={`ready-badge ${p.ready ? 'is-ready' : ''}`}>
                {p.ready ? (
                  <>
                    <Check size={14} /> Ready
                  </>
                ) : (
                  'Getting ready'
                )}
              </span>
            </div>
          ))}
          {room.players.length === 1 && (
            <div className="empty-seat">
              <PlayerBadge now={now} />
              <span className="waiting-dots" aria-label="Waiting">
                •••
              </span>
            </div>
          )}
        </div>
        <button
          className="button primary full"
          disabled={busy || me.ready}
          onClick={onReady}
        >
          {me.ready
            ? 'You’re ready. Waiting for your friend…'
            : busy
              ? 'Getting ready…'
              : 'I’m ready'}
          {!me.ready && <ArrowUpRight size={20} />}
        </button>
        <p className="privacy-note">
          <LockKeyhole size={13} /> Only two players. Your guesses stay yours
          until the end.
        </p>
      </div>
      <aside className="lobby-side">
        <span className="eyebrow">A LITTLE HEAD START</span>
        <div className="sample-word">
          {[...'HELLO'].map((x, i) => (
            <span
              className={`tile ${i === 0 ? 'correct' : i === 2 ? 'present' : 'absent'}`}
              key={i}
            >
              {x}
            </span>
          ))}
        </div>
        <h2>
          Good words.
          <br />
          Better company.
        </h2>
        <p>
          Five letters to find. Six chances each. Watch your friend’s progress
          without giving the game away.
        </p>
        <div className="lobby-legend">
          <span>
            <i className="correct" /> Right spot
          </span>
          <span>
            <i className="present" /> Wrong spot
          </span>
          <span>
            <i className="absent" /> Not here
          </span>
        </div>
        <p className="lobby-tip">
          Start with 1:30 each. Every green or yellow tile adds 20 seconds to
          your own clock. Three matching tiles? One extra minute.
        </p>
        <p className="lobby-tip">
          {room.mode === 'coop'
            ? 'In co-op, a solve from either player is a win for the team.'
            : 'In a duel, your first instinct might just beat their best guess.'}
        </p>
      </aside>
    </section>
  );
}
export function RoomGame({ code }: { code: string }) {
  const {
    room,
    error,
    fatal,
    connected,
    loading,
    busy,
    now,
    act,
    refresh,
    setError,
  } = useRoom(code);
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const submitting = useRef(false);
  const pending = useRef<{
    word: string;
    requestId: string;
    matchId: string;
  } | null>(null);
  const me = room?.players.find((p) => p.id === room.selfId);
  const opponent = room?.players.find((p) => p.id !== room.selfId);
  const phase = room?.match.phase;
  const lastAttempt = me?.attempts?.at(-1);
  const clockStopped = me?.solved || me?.count === 6;
  const clockNow = clockStopped
    ? (room?.match.startsAt ?? 0) + (lastAttempt?.elapsedMs ?? 0)
    : Math.max(now, room?.serverTime ?? 0);
  const remainingMs =
    phase === 'countdown'
      ? INITIAL_TIME_MS
      : Math.max(0, (me?.timerEndsAt ?? 0) - clockNow);
  const timeUp =
    me?.timedOut || (phase === 'active' && !clockStopped && remainingMs === 0);
  const canGuess =
    connected &&
    phase === 'active' &&
    !me?.solved &&
    !timeUp &&
    (me?.count ?? 6) < 6 &&
    !busy;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`Copy this room code to invite your friend: ${code}`);
    }
  };
  const key = useCallback(
    async (value: string) => {
      if (!canGuess || submitting.current || !room) return;
      if (value === 'Backspace') {
        setInput((s) => s.slice(0, -1));
        setError('');
      } else if (/^[a-zA-Z]$/.test(value)) {
        setInput((s) => (s + value.toUpperCase()).slice(0, 5));
        setError('');
      } else if (value === 'Enter') {
        if (input.length !== 5) {
          setError('Your guess needs exactly five letters.');
          return;
        }
        submitting.current = true;
        if (
          !pending.current ||
          pending.current.word !== input ||
          pending.current.matchId !== room.match.id
        )
          pending.current = {
            word: input,
            requestId: crypto.randomUUID(),
            matchId: room.match.id,
          };
        try {
          if (await act({ type: 'guess', ...pending.current })) {
            setAnnouncement(`Guess ${input} submitted.`);
            setInput('');
            pending.current = null;
          }
        } finally {
          submitting.current = false;
        }
      }
    },
    [canGuess, room, input, act, setError],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat ||
        document.querySelector('dialog[open]') ||
        (event.target instanceof HTMLElement &&
          (['INPUT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName) ||
            event.target.isContentEditable))
      )
        return;
      if (
        /^[a-zA-Z]$/.test(event.key) ||
        ['Enter', 'Backspace'].includes(event.key)
      ) {
        event.preventDefault();
        void key(event.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key]);
  async function join(event: React.FormEvent) {
    event.preventDefault();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    await act({ type: 'join', name: parsed.data });
  }
  const countdown = room?.match.startsAt
    ? Math.max(0, Math.ceil((room.match.startsAt - now) / 1000))
    : 0;
  return (
    <div className="page-shell room-shell">
      <Header>
        <button
          className="text-button share-button"
          onClick={() => void copy()}
        >
          <Share2 size={17} />
          {copied ? 'Copied!' : 'Share room'}
        </button>
      </Header>
      <main className="room-main">
        <div className="room-topline">
          <Link href="/" className="text-button">
            <ArrowLeft size={16} />
            Home
          </Link>
          <span className="eyebrow">
            {room?.mode === 'coop' ? 'BETTER TOGETHER' : 'HEAD TO HEAD'}
            <span className="topline-divider">/</span>ROOM {code}
          </span>
          <span className="round-label">ROUND {room?.match.round ?? '01'}</span>
        </div>
        {!connected && (
          <div className="connection-banner" role="status">
            <WifiOff size={18} />
            <span>
              Connection interrupted. Reconnecting… Your accepted guesses are
              saved.
            </span>
            <button onClick={() => void refresh()} className="text-button">
              Retry
            </button>
          </div>
        )}
        {loading ? (
          <div className="state-card">
            <span className="loading-ring" />
            <h1>Finding your lane…</h1>
            <p>Restoring your room and saved progress.</p>
          </div>
        ) : fatal === 403 && !room ? (
          <section className="state-card invite-card">
            <div className="lobby-icon">
              <HeartHandshake size={28} />
            </div>
            <span className="eyebrow">AN INVITATION TO PLAY</span>
            <h1>There’s a seat for you.</h1>
            <p>
              Join room <strong>{code}</strong>. Your friend is on the other
              side.
            </p>
            <form onSubmit={(event) => void join(event)}>
              <label htmlFor="join-name">Your display name</label>
              <input
                id="join-name"
                placeholder="What should we call you?"
                maxLength={20}
                autoComplete="nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="button primary full" disabled={busy}>
                Join your friend
                <ArrowUpRight size={19} />
              </button>
            </form>
          </section>
        ) : fatal && fatal !== 403 ? (
          <div className="state-card">
            <div className="lobby-icon">?</div>
            <h1>
              {fatal === 410 ? 'This lane has closed.' : 'A little lost?'}
            </h1>
            <p>{error}</p>
            <Link href="/" className="button primary">
              Find a fresh start
              <ArrowRightIcon />
            </Link>
          </div>
        ) : !room ? (
          <div className="state-card">
            <h1>Let’s reconnect.</h1>
            <p>The room server is taking a moment. Your invitation is safe.</p>
            <button className="button primary" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        ) : phase === 'lobby' ? (
          <Lobby
            room={room}
            now={now}
            busy={busy}
            onReady={() => void act({ type: 'ready' })}
            copied={copied}
            onCopy={() => void copy()}
          />
        ) : phase === 'complete' ? (
          <Results
            room={room}
            busy={busy}
            onRematch={() => {
              setInput('');
              void act({ type: 'rematch' });
            }}
          />
        ) : (
          <>
            <div className="match-header">
              <PlayerBadge player={me} self now={now} />
              <RoundTimer
                remainingMs={remainingMs}
                bonusMs={lastAttempt ? timeBonus(lastAttempt.marks) : 0}
                running={phase === 'active' && !clockStopped}
              />
              <PlayerBadge player={opponent} now={now} />
            </div>
            {opponent &&
              !opponent.isBot &&
              now - opponent.lastSeen >= 15000 && (
                <p className="opponent-offline" role="status">
                  Your friend disconnected. They can rejoin this room with their
                  progress intact.
                </p>
              )}
            <div className="arena">
              <section className="your-lane" aria-labelledby="your-lane-title">
                <div className="lane-heading">
                  <h1 id="your-lane-title">Your lane</h1>
                  <span>{me?.count ?? 0} OF 6 GUESSES</span>
                </div>
                <div className="board-wrap">
                  <Board attempts={me?.attempts ?? []} input={input} />
                  {phase === 'countdown' && (
                    <div className="countdown-overlay" role="status">
                      <span>MAKE YOURSELF READY</span>
                      <strong>{countdown || 'Go'}</strong>
                      <p>One word. Let’s find it.</p>
                    </div>
                  )}
                </div>
                <div className="guess-feedback" aria-live="polite">
                  {error ? (
                    <span className="error-message">{error}</span>
                  ) : me?.solved ? (
                    <span className="success-message">
                      You found it! Checking the finish…
                    </span>
                  ) : me?.count === 6 ? (
                    <span>
                      Your six are in. Waiting for{' '}
                      {opponent?.isBot ? 'Pip' : 'your friend'}…
                    </span>
                  ) : timeUp ? (
                    <span>
                      Your time is up. Waiting for{' '}
                      {opponent?.isBot ? 'Pip' : 'your friend'}…
                    </span>
                  ) : phase === 'countdown' ? (
                    'Both boards open at the same time.'
                  ) : (
                    <span>Trust your hunch. Make it five letters.</span>
                  )}
                </div>
                <Keyboard
                  attempts={me?.attempts ?? []}
                  onKey={(value) => void key(value)}
                  disabled={!canGuess}
                />
                <span className="physical-hint">
                  Your keyboard works here, too. Enter to submit.
                </span>
              </section>
              <aside className="opponent-lane">
                <div className="lane-heading">
                  <h2>The other lane</h2>
                  <LockKeyhole size={16} />
                </div>
                <p className="opponent-description">
                  {opponent?.isBot
                    ? 'Pip uses its own clues. Bot guesses stay hidden until the round ends.'
                    : `${opponent?.name}’s progress. The words are their little secret.`}
                </p>
                <MaskedBoard count={opponent?.count ?? 0} />
                <div className="opponent-note">
                  <Radio size={16} />
                  <span>
                    {opponent?.solved
                      ? 'A finish is being checked…'
                      : opponent?.timedOut
                        ? 'Their time is up. You can keep guessing.'
                        : opponent?.count === 6
                          ? 'All six guesses are in.'
                          : 'A little thinking. A little suspense.'}
                  </span>
                </div>
                <div className="arena-legend">
                  <span>
                    <i className="correct" /> Right spot
                  </span>
                  <span>
                    <i className="present" /> Wrong spot
                  </span>
                  <span>
                    <i className="absent" /> Not here
                  </span>
                </div>
                <div className="lane-note">
                  {room.mode === 'duel'
                    ? 'Fast fingers help. A good word helps more.'
                    : 'Two sets of six chances. One shared victory.'}
                </div>
              </aside>
            </div>
          </>
        )}
        {error &&
          phase !== 'active' &&
          phase !== 'countdown' &&
          !(fatal && fatal !== 403) && (
            <p role="alert" className="error-message room-error">
              {fatal === 403 && error === 'Join this room to play.'
                ? ''
                : error}
            </p>
          )}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}{' '}
          {me?.attempts
            ?.at(-1)
            ?.word.split('')
            .map((l, i) => `${l} ${me.attempts!.at(-1)!.marks[i]}`)
            .join(', ')}
        </div>
      </main>
      <Footer />
    </div>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={19} />;
}
