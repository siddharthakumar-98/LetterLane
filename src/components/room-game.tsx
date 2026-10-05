'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  HeartHandshake,
  LockKeyhole,
  Share2,
  Swords,
  WifiOff,
} from 'lucide-react';
import { Header, Footer } from './chrome';
import { Board, MaskedBoard } from './board';
import { Keyboard } from './keyboard';
import { Results } from './results';
import { RoundTimer } from './round-timer';
import { initialTime, timeBonus } from '@/lib/game/round-clock';
import { useRoom } from '@/lib/client/use-room';
import type { Attempt, PlayerView, RoomView } from '@/lib/game/types';
import { nameSchema } from '@/lib/game/validation';
import { WORD_LEVELS, wordLengthMessage } from '@/lib/game/word-length';
import { PHRASE_LEVELS } from '@/lib/game/phrase-difficulty';
import { phraseMetadata } from '@/lib/game/phrases';
import { usePhraseValidation } from '@/lib/client/use-phrase-validation';
import { PhraseInstructions } from './phrase-instructions';
import { canPlayWithBot } from '@/lib/game/matchmaking';
import { BotNotice, BotTag } from './bot-notice';
const EMPTY_ATTEMPTS: Attempt[] = [];
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
  onPlayBot,
  copied,
  onCopy,
}: {
  room: RoomView;
  now: number;
  busy: boolean;
  onReady: () => void;
  onPlayBot: () => void;
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
        <span className="eyebrow">
          YOUR PRIVATE ROOM
          {room.game !== 'phrases' &&
            ` · ${WORD_LEVELS[room.wordLength ?? 5].label} · ${room.wordLength ?? 5} letters`}
          {room.game === 'phrases' &&
            ` · ${PHRASE_LEVELS[room.phraseDifficulty ?? 'normal'].label} · up to ${PHRASE_LEVELS[room.phraseDifficulty ?? 'normal'].maxWords} words`}
        </span>
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
        <BotNotice room={room} />
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
          disabled={busy || (me.ready && !canPlayWithBot(room, room.selfId))}
          onClick={canPlayWithBot(room, room.selfId) ? onPlayBot : onReady}
        >
          {canPlayWithBot(room, room.selfId)
            ? busy
              ? 'Starting with bot…'
              : 'Play with bot'
            : me.ready
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
        {room.game === 'phrases' ? (
          <>
            <h2>How this round works</h2>
            <PhraseInstructions difficulty={room.phraseDifficulty} />
          </>
        ) : (
          <>
            <h2>How this round works</h2>
            <p>
              {room.wordLength ?? 5} letters to find. Six chances each. Watch
              your friend’s progress without giving the game away.
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
              Start with 1:30 each. Every green or yellow tile adds 20 seconds
              to your own clock. Three matching tiles? One extra minute.
            </p>
          </>
        )}
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
  const phrases = room?.game === 'phrases';
  const template = room?.match.phraseTemplate;
  const wordLength = room?.wordLength ?? 5;
  const metadata = useMemo(
    () => (template ? phraseMetadata(template) : undefined),
    [template],
  );
  const letterCount = metadata?.letterCount ?? wordLength;
  const matchId = room?.match.id;
  const homePath = phrases ? '/phrases' : '/';
  const lastAttempt = me?.attempts?.at(-1);
  const clockStopped = me?.solved || me?.count === 6;
  const displayNow = Math.max(now, room?.serverTime ?? 0);
  const remainingFor = (player: PlayerView | undefined) =>
    phase === 'countdown'
      ? initialTime(room?.game)
      : Math.max(
          0,
          (player?.timerEndsAt ?? 0) - (player?.timerStoppedAt ?? displayNow),
        );
  const remainingMs = remainingFor(me);
  const opponentFinished =
    !!opponent &&
    (opponent.solved ||
      opponent.timedOut ||
      opponent.count === 6 ||
      (phase === 'active' && remainingFor(opponent) === 0));
  const timeUp =
    me?.timedOut || (phase === 'active' && !clockStopped && remainingMs === 0);
  const canGuess =
    connected &&
    phase === 'active' &&
    !me?.solved &&
    !timeUp &&
    (me?.count ?? 6) < 6 &&
    !busy;
  const phraseValidation = usePhraseValidation(
    template,
    input,
    phrases && connected && phase === 'active' && !clockStopped && !timeUp,
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`Copy this room code to invite your friend: ${code}`);
    }
  };
  useEffect(() => {
    if (!phrases || phase !== 'active') return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelector('.your-lane .phrase-guess:last-child')
        ?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [phrases, phase, me?.count, room?.match.id]);
  const key = useCallback(
    async (value: string) => {
      if (!canGuess || submitting.current || !matchId) return;
      if (value === 'Backspace') {
        setInput((s) => s.slice(0, -1));
        setError('');
      } else if (/^[a-zA-Z]$/.test(value)) {
        setInput((s) => (s + value.toUpperCase()).slice(0, letterCount));
        setError('');
      } else if (value === 'Enter') {
        if (input.length !== letterCount) {
          setError(
            phrases
              ? `Fill all ${letterCount} letters before submitting.`
              : wordLengthMessage(wordLength),
          );
          return;
        }
        submitting.current = true;
        if (
          !pending.current ||
          pending.current.word !== input ||
          pending.current.matchId !== matchId
        )
          pending.current = {
            word: input,
            requestId: crypto.randomUUID(),
            matchId,
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
    [canGuess, matchId, input, act, setError, letterCount, phrases, wordLength],
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
    ? Math.max(0, Math.ceil((room.match.startsAt - displayNow) / 1000))
    : 0;
  return (
    <div className={`page-shell room-shell ${phrases ? 'phrase-mode' : ''}`}>
      <Header
        game={room?.game}
        wordLength={wordLength}
        phraseDifficulty={room?.phraseDifficulty}
        showGameSwitch={false}
      >
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
          <Link href={homePath} className="text-button">
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
            <Link href={homePath} className="button primary">
              Find a fresh start
              <ArrowUpRight size={19} />
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
            onPlayBot={() => void act({ type: 'play-bot' })}
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
            <div
              className="match-header"
              role="group"
              aria-label="Players and round timers"
            >
              <div className="match-player">
                <PlayerBadge player={me} self now={now} />
                <RoundTimer
                  remainingMs={remainingMs}
                  bonusMs={
                    lastAttempt ? timeBonus(lastAttempt.marks, room.game) : 0
                  }
                  running={phase === 'active' && !clockStopped}
                />
              </div>
              <div className="match-player">
                <PlayerBadge player={opponent} now={now} />
                <RoundTimer
                  remainingMs={remainingFor(opponent)}
                  bonusMs={0}
                  label={
                    opponent?.isBot
                      ? `${opponent.name} · BOT`
                      : `${opponent?.name ?? 'Opponent'}’s time`
                  }
                  running={
                    phase === 'active' &&
                    !opponent?.solved &&
                    opponent?.count !== 6
                  }
                  announce={false}
                />
              </div>
            </div>
            {opponent &&
              !opponent.isBot &&
              now - opponent.lastSeen >= 15000 && (
                <p className="opponent-offline" role="status">
                  Your friend disconnected. They can rejoin this room with their
                  progress intact.
                </p>
              )}
            <div className={`arena ${phrases ? 'phrase-arena' : ''}`}>
              <section className="your-lane" aria-labelledby="your-lane-title">
                <div className="lane-heading">
                  <h1 id="your-lane-title">Your lane</h1>
                  <span>{me?.count ?? 0} OF 6 GUESSES</span>
                </div>
                <div
                  className={`board-wrap ${phase === 'countdown' ? 'is-counting-down' : ''}`}
                >
                  <Board
                    attempts={me?.attempts ?? EMPTY_ATTEMPTS}
                    input={input}
                    template={template}
                    wordLength={wordLength}
                  />
                  {phase === 'countdown' && (
                    <div className="countdown-overlay" role="status">
                      <span>MAKE YOURSELF READY</span>
                      <strong>{countdown || 'Go'}</strong>
                      <p>
                        {phrases
                          ? 'One phrase. Let’s find it.'
                          : 'One word. Let’s find it.'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="guess-controls">
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
                        {opponent?.isBot ? opponent.name : 'your friend'}…
                      </span>
                    ) : timeUp ? (
                      <span>
                        Your time is up. Waiting for{' '}
                        {opponent?.isBot ? opponent.name : 'your friend'}…
                      </span>
                    ) : phase === 'countdown' ? (
                      'Both boards open at the same time.'
                    ) : phraseValidation ? (
                      <span className="error-message">{phraseValidation}</span>
                    ) : (
                      <span>
                        {phrases
                          ? `${metadata!.wordCount} words · ${letterCount} letters. Spaces and punctuation are automatic.`
                          : `Trust your hunch. Make it ${WORD_LEVELS[wordLength].name} letters.`}
                      </span>
                    )}
                  </div>
                  <Keyboard
                    attempts={me?.attempts ?? EMPTY_ATTEMPTS}
                    onKey={key}
                    disabled={!canGuess}
                  />
                </div>
                <span className="physical-hint">
                  Your keyboard works here, too. Enter to submit.
                </span>
              </section>
              <aside
                className="opponent-lane"
                aria-labelledby="opponent-lane-title"
              >
                <div className="lane-heading">
                  <h2 id="opponent-lane-title">The other lane</h2>
                  <span>{opponent?.count ?? 0} OF 6 GUESSES</span>
                </div>
                <MaskedBoard
                  count={opponent?.count ?? 0}
                  guessMarks={opponent?.guessMarks}
                  template={template}
                  wordLength={wordLength}
                  finished={opponentFinished}
                />
                {(opponent?.solved ||
                  opponent?.timedOut ||
                  opponent?.count === 6) && (
                  <p className="opponent-progress" role="status">
                    {opponent.solved
                      ? 'A finish is being checked…'
                      : opponent.timedOut
                        ? 'Their time is up. You can keep guessing.'
                        : 'All six guesses are in.'}
                  </p>
                )}
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
          {lastAttempt?.word
            .split('')
            .map((l, i) => `${l} ${lastAttempt.marks[i]}`)
            .join(', ')}
        </div>
      </main>
      <Footer
        game={room?.game}
        wordLength={wordLength}
        phraseDifficulty={room?.phraseDifficulty}
      />
    </div>
  );
}
