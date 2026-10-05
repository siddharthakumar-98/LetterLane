import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPage } from '@/components/content-page';
import { BOT_PROFILES } from '@/lib/game/bot-difficulty';
import { MAX_ATTEMPTS } from '@/lib/game/rules';

export const metadata: Metadata = {
  title: 'FAQ — LetterLane',
  description:
    'Answers to common LetterLane questions: accounts, invitations, bots, reconnecting, scoring, rematches, privacy and ads.',
};
const bots = Object.values(BOT_PROFILES)
  .map((bot) => `${bot.name} (${bot.label})`)
  .join(', ');
const questions: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Do I need an account?',
    a: 'No. Pick a display name and play. Your browser keeps an anonymous guest session so you can return to your rooms; there is no email, password or profile.',
  },
  {
    q: 'How do I invite a friend?',
    a: 'Create a room, then copy the invite link or share the six-character room code. Your friend opens the link or enters the code on the home page and chooses a name. Each room holds exactly two players.',
  },
  {
    q: 'Can I play on my own?',
    a: (
      <>
        Yes. Choose I’m ready, then Play with bot while the second seat is open.
        There are three bots: {bots}. Easier bots wait longer between guesses
        and choose simpler words. A bot never joins unless you ask.
      </>
    ),
  },
  {
    q: 'What is the difference between Words and Phrases?',
    a: (
      <>
        Words hides a single five-, six- or seven-letter word. Phrases hides a
        familiar saying of up to seven words and adds blue tiles for letters
        that belong to a different word. Both give you {MAX_ATTEMPTS} guesses.
        The <Link href="/how-to-play">How to play</Link> page explains every
        color.
      </>
    ),
  },
  {
    q: 'Duel or co-op: which should I pick?',
    a: 'In a duel the first solver wins, and if neither of you solves it, the best single guess decides. In co-op you share the result: if either of you solves it, you both win.',
  },
  {
    q: 'Can the other player see my guesses?',
    a: 'They see the colors of your tiles and your clock, never your letters, until the round is over. The answer is not sent to either browser during play.',
  },
  {
    q: 'Why was my word rejected?',
    a: 'Guesses must be the right length and in the game’s word list, and you cannot repeat a word you already played. Phrases also checks each word separately and tells you which position is not accepted. Rejected guesses never use up a turn.',
  },
  {
    q: 'How does the timer work?',
    a: 'Each player has their own clock: 1:30 in Words and 3:00 in Phrases. Each green or yellow tile in Words adds 20 seconds; each green, orange or blue tile in Phrases adds five seconds. When your clock runs out, you stop guessing and the other player can finish.',
  },
  {
    q: 'What happens if I lose my connection?',
    a: 'Your accepted guesses are saved. Reopen the room in the same browser to continue. Your clock keeps running while you are away, so come back quickly.',
  },
  {
    q: 'How do rematches work?',
    a: 'When a round ends, both players can choose One more round. Once both agree, a new countdown starts with a fresh puzzle in the same room. Bots always agree to a rematch.',
  },
  {
    q: 'How long does a room last?',
    a: 'A room stays open for 24 hours, and starting a rematch extends it. After that, create a new room from the home page.',
  },
  {
    q: 'Why are there ads?',
    a: (
      <>
        Ads keep LetterLane free. You may see one ad on the home pages and an
        occasional full-screen ad when you arrive in a room’s waiting area. It
        appears before you are ready, so it never interrupts a round or costs
        you time. The <Link href="/privacy">privacy page</Link> explains how ads
        use cookies and how to change your choices.
      </>
    ),
  },
];

export default function Page() {
  return (
    <ContentPage
      eyebrow="QUESTIONS AND ANSWERS"
      title="Frequently asked questions"
      intro={
        <>
          Short answers to what new players ask most. For the complete rules,
          read <Link href="/how-to-play">How to play</Link>.
        </>
      }
    >
      <dl className="faq-list">
        {questions.map(({ q, a }) => (
          <div key={q}>
            <dt>{q}</dt>
            <dd>{a}</dd>
          </div>
        ))}
      </dl>
    </ContentPage>
  );
}
