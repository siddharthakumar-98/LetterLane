import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';
import answers from '@/lib/server/dictionary/answers.json';
import allowed from '@/lib/server/dictionary/allowed-guesses.json';
import longAnswers from '@/lib/server/dictionary/long-answers.json';
import proverbs from '@/lib/server/phrases/proverbs.json';

export const metadata: Metadata = {
  title: 'About LetterLane',
  description:
    'Why LetterLane exists, how it keeps two-player word games fair and private, and where its words and phrases come from.',
};
const count = (n: number) => n.toLocaleString('en-US');

export default function Page() {
  return (
    <ContentPage
      eyebrow="ABOUT LETTERLANE"
      title="A little friendly wordplay, for two"
      intro={
        <>
          LetterLane turns the quiet, solo habit of a daily word puzzle into
          something you share. Two people get the same hidden word or phrase,
          race or cooperate in real time, and compare notes at the end.
        </>
      }
    >
      <section aria-labelledby="why">
        <h2 id="why">Why we made it</h2>
        <p>
          Word puzzles are more fun with someone on the other side: a friend in
          another city, a sibling on the sofa, a colleague at lunch. Most puzzle
          games are built for one player and a score to post afterwards.
          LetterLane is built for the moment itself. You see the other player’s
          progress as colored tiles while you play, feel the pressure of their
          clock beside yours, and only learn their actual guesses when the round
          is over.
        </p>
        <p>
          There is no account to create and no app to install. Choose a name,
          share a link, and play. If nobody is free, one of three bots will take
          the other seat.
        </p>
      </section>

      <section aria-labelledby="different">
        <h2 id="different">What makes it different</h2>
        <ul>
          <li>
            <strong>Simultaneous play.</strong> Both boards open after the same
            countdown, so every round is a real race or a real team effort.
          </li>
          <li>
            <strong>Personal clocks.</strong> Good guesses earn time on your own
            clock, which rewards informative guesses as well as fast ones.
          </li>
          <li>
            <strong>Two puzzle types.</strong> Words offers five-, six- and
            seven-letter rounds. Phrases asks you to rebuild a whole saying,
            with a blue hint for letters that belong to a different word.
          </li>
          <li>
            <strong>Duel or co-op.</strong> Compete head to head, or share a
            single goal where either player’s solve wins for both.
          </li>
          <li>
            <strong>Private by design.</strong> Rooms are invitation-only, and
            your letters stay hidden from the other player until the result.
          </li>
        </ul>
        <p>
          New here? The <Link href="/how-to-play">full rules</Link> explain
          every color, bonus and tie-break, and the <Link href="/faq">FAQ</Link>{' '}
          answers the most common questions.
        </p>
      </section>

      <section aria-labelledby="fair">
        <h2 id="fair">Fair play</h2>
        <p>
          The answer never reaches your browser while a round is in progress.
          Every guess is checked and scored on the server, which also keeps the
          official time, so a slow connection or a trick in the browser cannot
          change who solved first. Bots follow exactly the same rules: they only
          see the colors of their own guesses, never the answer or yours.
        </p>
      </section>

      <section aria-labelledby="words-source">
        <h2 id="words-source">Where the words come from</h2>
        <p>
          Five-letter answers come from {count(answers.length)} hand-picked,
          familiar words, and {count(allowed.length)} five-letter words are
          accepted as guesses. Six- and seven-letter rounds draw from{' '}
          {count(longAnswers['6'].length)} and {count(longAnswers['7'].length)}{' '}
          curated answers, checked against an ordinary-English vocabulary built
          from{' '}
          <a
            href="https://github.com/en-wl/wordlist"
            rel="noopener noreferrer"
            target="_blank"
          >
            SCOWL
          </a>{' '}
          by Kevin Atkinson, which also validates every word in Phrases.
        </p>
        <p>
          The {count(proverbs.phrases.length)} Phrases answers are traditional
          sayings adapted from Wikipedia’s{' '}
          <a
            href="https://en.wikipedia.org/wiki/List_of_proverbial_phrases"
            rel="noopener noreferrer"
            target="_blank"
          >
            List of proverbial phrases
          </a>{' '}
          (Wikipedia contributors,{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            rel="noopener noreferrer"
            target="_blank"
          >
            CC BY-SA 4.0
          </a>
          ). We kept the short sayings only and normalized their spelling and
          punctuation for play.
        </p>
      </section>

      <section aria-labelledby="independent">
        <h2 id="independent">Independent and ad-supported</h2>
        <p>
          LetterLane is an independent game. It is not affiliated with or
          endorsed by The New York Times, Wordle or any other puzzle publisher.
          The site is kept free by ads: one ad space on each home page, plus an
          occasional full-screen ad when you arrive in a room’s waiting area,
          before you are ready. Ads never appear on top of a round in progress
          and never cost you game time. See the{' '}
          <Link href="/privacy">privacy page</Link> for what that involves.
        </p>
      </section>
    </ContentPage>
  );
}
