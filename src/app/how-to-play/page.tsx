import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';
import { PhraseExample, WordExample } from '@/components/tile-examples';
import { BOT_PROFILES } from '@/lib/game/bot-difficulty';
import { WORD_LENGTHS, WORD_LEVELS } from '@/lib/game/word-length';
import {
  PHRASE_DIFFICULTIES,
  PHRASE_LEVELS,
} from '@/lib/game/phrase-difficulty';
import { initialTime, TILE_BONUS_MS } from '@/lib/game/round-clock';
import { MAX_ATTEMPTS, SYNC_WINDOW_MS } from '@/lib/game/rules';

export const metadata: Metadata = {
  title: 'How to Play — LetterLane',
  description:
    'Complete rules for LetterLane Words and Phrases: tile colors, personal clocks and time bonuses, duel and co-op scoring, bots, and strategy tips.',
};
const clock = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String((ms / 1000) % 60).padStart(2, '0')}`;
const seconds = (ms: number) => `${Math.round(ms / 1000)} seconds`;

export default function Page() {
  return (
    <ContentPage
      eyebrow="THE FULL RULES"
      title="How to play LetterLane"
      intro={
        <>
          LetterLane is a two-player guessing game. You and one other player (a
          friend or a bot) chase the same hidden puzzle at the same time, each
          on your own board, with your own clock. Choose <strong>Words</strong>{' '}
          for a single five-, six- or seven-letter word, or{' '}
          <strong>Phrases</strong> for a whole saying of up to seven words.
        </>
      }
    >
      <section aria-labelledby="start">
        <h2 id="start">Start a room</h2>
        <ol>
          <li>
            Open <Link href="/">Words</Link> or{' '}
            <Link href="/phrases">Phrases</Link> and type the name the other
            player will see.
          </li>
          <li>
            Pick <strong>Head to head</strong> (a duel) or{' '}
            <strong>Better together</strong> (co-op), then the puzzle difficulty
            and the bot difficulty.
          </li>
          <li>
            Create the room and send the invite link or the six-character room
            code to a friend. They join from any browser, with no account.
          </li>
          <li>
            When you both choose <strong>I’m ready</strong>, a three-second
            countdown starts and both boards open together. Playing alone? Ready
            up, then choose <strong>Play with bot</strong> to fill the open seat
            right away.
          </li>
        </ol>
      </section>

      <section aria-labelledby="words">
        <h2 id="words">Playing Words</h2>
        <p>
          Guess the hidden word in {MAX_ATTEMPTS} tries or fewer. Every guess
          must be a real word of the room’s length:{' '}
          {WORD_LENGTHS.map(
            (length) => `${WORD_LEVELS[length].label} has ${length} letters`,
          ).join(', ')}
          . After you press Enter, each tile changes color:
        </p>
        <ul className="legend-text">
          <li>
            <span className="swatch correct" /> <strong>Green:</strong> the
            letter is in the word and in exactly that spot.
          </li>
          <li>
            <span className="swatch present" /> <strong>Yellow:</strong> the
            letter is in the word, but somewhere else.
          </li>
          <li>
            <span className="swatch absent" /> <strong>Grey:</strong> the word
            has no more of this letter.
          </li>
        </ul>
        <p>
          Suppose the answer is CRANE and you guess TRACE. R, A and E are in the
          right places, C belongs elsewhere, and there is no T:
        </p>
        <WordExample answer="CRANE" guess="TRACE" />
        <p>
          <strong>Repeated letters</strong> only light up as many times as the
          answer contains them. If the answer is ALLEY and you guess LLAMA, the
          second L is green, the first L is yellow (ALLEY has a second L), the
          first A is yellow, and the final A is grey because ALLEY has only one
          A:
        </p>
        <WordExample answer="ALLEY" guess="LLAMA" />
        <p>
          Guesses that are too short, not in the word list, or already played
          are rejected without using a turn. Type with your physical keyboard or
          the on-screen keys; Backspace corrects and Enter submits.
        </p>
      </section>

      {/* phrase-mode switches the shared present color to Phrases orange. */}
      <section className="phrase-mode" aria-labelledby="phrases">
        <h2 id="phrases">Playing Phrases</h2>
        <p>
          In Phrases the hidden answer is a familiar saying.{' '}
          {PHRASE_DIFFICULTIES.map(
            (level) =>
              `${PHRASE_LEVELS[level].label} phrases have up to ${PHRASE_LEVELS[level].maxWords} words`,
          ).join('; ')}
          . The board shows how many letters each word has. Spaces, commas,
          apostrophes and hyphens fill in automatically, so you only type
          letters. Every word you enter must be a real English word; the game
          points out which word is not accepted before you submit. Phrases add a
          fourth color because letters can belong to other words:
        </p>
        <ul className="legend-text">
          <li>
            <span className="swatch correct" /> <strong>Green:</strong> right
            letter, right spot.
          </li>
          <li>
            <span className="swatch present" /> <strong>Orange:</strong> the
            letter is in this same word, in a different spot.
          </li>
          <li>
            <span className="swatch elsewhere" /> <strong>Blue:</strong> the
            letter is not left in this word, but appears in another word of the
            phrase.
          </li>
          <li>
            <span className="swatch absent" /> <strong>Grey:</strong> no
            remaining occurrence anywhere in the phrase.
          </li>
        </ul>
        <p>
          Colors are handed out once per letter in the answer: all greens first,
          then oranges within each word, then blues across words, from left to
          right. Here the answer is CAT BAG TIME and the guess is TAR CAB TIME.
          T is orange because CAT has a T in another spot, C is blue because it
          belongs to CAT, B is orange within BAG, and R is grey:
        </p>
        <PhraseExample answer="CAT BAG TIME" guess="TAR CAB TIME" />
      </section>

      <section aria-labelledby="clock">
        <h2 id="clock">Your personal clock</h2>
        <p>
          When the countdown ends, each player’s clock starts:{' '}
          <strong>{clock(initialTime('words'))}</strong> in Words and{' '}
          <strong>{clock(initialTime('phrases'))}</strong> in Phrases. Good
          guesses buy time. In Words every green or yellow tile adds{' '}
          {seconds(TILE_BONUS_MS)} to your own clock, so the TRACE guess above
          would earn 80 seconds. In Phrases every green, orange or blue tile
          adds five seconds. Grey tiles, rejected guesses and repeated words
          earn nothing.
        </p>
        <p>
          Clocks keep running if you lose connection, and you can rejoin while
          time remains. When your clock reaches zero your guesses stop, but the
          other player can keep going until they solve it, run out of time or
          use all {MAX_ATTEMPTS} guesses.
        </p>
      </section>

      <section aria-labelledby="winning">
        <h2 id="winning">Winning a duel or a co-op round</h2>
        <p>
          <strong>Duel:</strong> the first player to solve it wins. Solves that
          land within {SYNC_WINDOW_MS} milliseconds of each other are compared
          by guesses used, then by the server’s recorded time, and an exact tie
          is a draw. If neither player solves the puzzle, the better single
          guess wins: most correct letters revealed (green plus yellow, orange
          or blue), then who reached that total earlier, then most exact
          positions, then most misplaced letters.
        </p>
        <p>
          <strong>Co-op:</strong> a solve by either player is a win for the
          team. If both of you run out of guesses or time first, the team loses
          together.
        </p>
        <p>
          In both modes you can watch the other player’s tile colors and clock,
          but their letters stay hidden until the round ends. Then the answer,
          both boards and the result are revealed. When both players choose a
          rematch, a new round starts with a fresh puzzle; bots always agree.
        </p>
      </section>

      <section aria-labelledby="bots">
        <h2 id="bots">Playing with a bot</h2>
        <p>
          Bots never see the answer. They read the colors of their own guesses,
          just like you, and follow the same clock, guess limit and scoring.
        </p>
        <table className="content-table">
          <thead>
            <tr>
              <th scope="col">Difficulty</th>
              <th scope="col">Bot</th>
              <th scope="col">Time between guesses</th>
              <th scope="col">Style</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(BOT_PROFILES).map((bot) => (
              <tr key={bot.name}>
                <td>{bot.label}</td>
                <td>{bot.name}</td>
                <td>
                  {bot.thinkMinMs / 1000}–{bot.thinkMaxMs / 1000} seconds
                </td>
                <td>{bot.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="tips">
        <h2 id="tips">Tips for better guesses</h2>
        <ul>
          <li>
            Open with a word that tests common letters such as E, A, R, T and S.
            Even all-grey tiles rule out a lot.
          </li>
          <li>
            Chase colors early. Each green or yellow tile in Words is worth{' '}
            {seconds(TILE_BONUS_MS)}, so an informative guess also extends your
            clock.
          </li>
          <li>
            Remember duplicates. A grey second copy of a letter means the answer
            has only as many as were colored.
          </li>
          <li>
            In Phrases, solve the short words first. Two- and three-letter words
            have few options, and their colors feed blue hints to the rest of
            the phrase.
          </li>
          <li>
            Use the keyboard colors as a summary of everything you have learned,
            but check the board for exact positions.
          </li>
        </ul>
      </section>
    </ContentPage>
  );
}
