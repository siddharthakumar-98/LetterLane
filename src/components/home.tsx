'use client';
import { PhraseRow } from './phrase-board';
import { DifficultyOptions } from './difficulty-options';
import { PhraseInstructions } from './phrase-instructions';
import {
  phraseTemplate,
  playableLetters,
  scorePhrase,
} from '@/lib/game/phrases';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  HeartHandshake,
  LockKeyhole,
  Swords,
} from 'lucide-react';
import { Header, Footer } from './chrome';
import { api, ApiError } from '@/lib/client/api';
import { codeSchema, nameSchema } from '@/lib/game/validation';
import type {
  Mode,
  RoomView,
  BotDifficulty,
  GameKind,
  WordLength,
  PhraseDifficulty,
} from '@/lib/game/types';
import { BOT_PROFILES } from '@/lib/game/bot-difficulty';
import { WORD_LENGTHS, WORD_LEVELS } from '@/lib/game/word-length';
import {
  PHRASE_DIFFICULTIES,
  PHRASE_LEVELS,
} from '@/lib/game/phrase-difficulty';
const wordOptions = WORD_LENGTHS.map((value) => ({
  value,
  label: WORD_LEVELS[value].label,
  detail: `${value} letters`,
}));
const phraseOptions = PHRASE_DIFFICULTIES.map((value) => ({
  value,
  label: PHRASE_LEVELS[value].label,
  detail: `Up to ${PHRASE_LEVELS[value].maxWords} words`,
}));
const botOptions = (['easy', 'medium', 'hard'] as const).map((value) => ({
  value,
  label: BOT_PROFILES[value].label,
}));
const phraseExample = {
  template: phraseTemplate('CAT BAG TIME'),
  letters: playableLetters('TAR CAB TIME'),
  marks: scorePhrase('CAT BAG TIME', 'TAR CAB TIME'),
};

export default function Home({ game = 'words' }: { game?: GameKind }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<Mode>('duel');
  const [wordLength, setWordLength] = useState<WordLength>(5);
  const [phraseDifficulty, setPhraseDifficulty] =
    useState<PhraseDifficulty>('normal');
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
          : {
              name: parsedName.data,
              mode,
              botDifficulty,
              game,
              ...(game === 'words' ? { wordLength } : {}),
              ...(game === 'phrases' ? { phraseDifficulty } : {}),
            },
      );
      localStorage.setItem(
        game === 'phrases' ? 'letterlane-phrases-name' : 'letterlane-name',
        parsedName.data,
      );
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
    <div className={`page-shell ${game === 'phrases' ? 'phrase-mode' : ''}`}>
      <Header
        game={game}
        wordLength={wordLength}
        phraseDifficulty={phraseDifficulty}
      />
      <main className="home-main">
        <section className="start-panel" aria-labelledby="home-title">
          <div className="home-intro">
            <h1 id="home-title">
              Two minds.
              <br />
              <span>{game === 'phrases' ? 'One phrase.' : 'One word.'}</span>
            </h1>
            <p className="home-description">
              {game === 'phrases'
                ? 'Find a familiar saying with a friend or a bot.'
                : 'Find the hidden word with a friend or a bot.'}
            </p>
            <p className="home-facts">
              <span>
                {game === 'phrases'
                  ? `Up to ${PHRASE_LEVELS[phraseDifficulty].maxWords} words`
                  : '5–7 letters'}
              </span>
              <span>6 guesses</span>
              <span>2 players</span>
            </p>
            {game === 'phrases' ? (
              <section className="home-preview" aria-label="An example phrase">
                <p className="preview-label">Example phrase feedback</p>
                <div className="phrase-preview">
                  <PhraseRow {...phraseExample} />
                </div>
                <details className="phrase-help">
                  <summary>How to play Phrases</summary>
                  <PhraseInstructions difficulty={phraseDifficulty} />
                </details>
              </section>
            ) : (
              <section className="home-preview" aria-label="An example round">
                <p className="preview-label">Example guesses</p>
                <div className="preview-game">
                  <div
                    className="preview-tiles"
                    aria-label="Example: guesses SLATE, CHIME, CHARM"
                  >
                    {[
                      {
                        word: 'SLATE',
                        marks: [
                          'absent',
                          'absent',
                          'correct',
                          'absent',
                          'absent',
                        ],
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
                    ].map((row) => (
                      <div className="tile-row" key={row.word}>
                        {[...row.word].map((letter, j) => (
                          <span className={`tile ${row.marks[j]}`} key={j}>
                            {letter}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="preview-legend">
                  <span>
                    <i className="correct" />
                    Right spot
                  </span>
                  <span>
                    <i className="present" />
                    Wrong spot
                  </span>
                  <span>
                    <i className="absent" />
                    Not here
                  </span>
                </div>
              </section>
            )}
          </div>
          <div className="home-setup">
            <h2>Set up your game</h2>
            <form
              className="start-form"
              onSubmit={(event) => {
                event.preventDefault();
                void start(false);
              }}
            >
              <div className="name-field">
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
              </div>
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
                  {mode === 'duel' && (
                    <Check className="mode-check" size={16} />
                  )}
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
                  {mode === 'coop' && (
                    <Check className="mode-check" size={16} />
                  )}
                </label>
              </fieldset>
              {game === 'words' && (
                <fieldset className="difficulty-picker" disabled={!!busy}>
                  <legend>Word difficulty</legend>
                  <DifficultyOptions
                    name="word-length"
                    value={wordLength}
                    onChange={setWordLength}
                    options={wordOptions}
                  />
                  <p>Both players use this word length for every round.</p>
                </fieldset>
              )}
              {game === 'phrases' && (
                <fieldset
                  className="difficulty-picker phrase-difficulty"
                  disabled={!!busy}
                >
                  <legend>Phrase difficulty</legend>
                  <DifficultyOptions
                    name="phrase-difficulty"
                    value={phraseDifficulty}
                    onChange={setPhraseDifficulty}
                    options={phraseOptions}
                  />
                  <p>Both players use this phrase limit for every round.</p>
                </fieldset>
              )}
              <fieldset
                className="difficulty-picker"
                disabled={!!busy}
                aria-describedby="difficulty-help"
              >
                <legend>Bot difficulty</legend>
                <DifficultyOptions
                  name="bot-difficulty"
                  value={botDifficulty}
                  onChange={setBotDifficulty}
                  options={botOptions}
                />
                <p id="difficulty-help">
                  If no friend joins, choose who fills the open seat.
                </p>
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
          </div>
        </section>
      </main>
      <Footer
        game={game}
        wordLength={wordLength}
        phraseDifficulty={phraseDifficulty}
      />
    </div>
  );
}
