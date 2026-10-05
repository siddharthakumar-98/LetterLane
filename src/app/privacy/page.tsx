import type { Metadata } from 'next';
import { ContentPage } from '@/components/content-page';
import { ConsentChoices } from '@/components/consent-choices';
export const metadata: Metadata = {
  title: 'Privacy — LetterLane',
  description: 'How LetterLane handles guest identities, game data and ads.',
};
// Draft wording: review it for your deployment and jurisdiction before launch.
export default function Page() {
  return (
    <ContentPage
      eyebrow="YOUR DATA"
      title="Privacy"
      intro="LetterLane is a private word game for two players. You can play without an account. This page explains what the game stores and how advertising works."
    >
      <h2>What the game stores</h2>
      <ul>
        <li>
          <strong>A guest identity.</strong> Your browser receives an anonymous
          guest session so you can rejoin your rooms. It is not linked to your
          name, email or another account.
        </li>
        <li>
          <strong>Game data.</strong> The display name you choose, the rooms you
          join, your accepted guesses and match results. Rooms expire after 24
          hours and are kept until scheduled database cleanup removes them.
        </li>
        <li>
          <strong>Browser storage.</strong> Your last display name, and a note
          that a room’s lobby ad has already been shown in this tab.
        </li>
        <li>
          <strong>Abuse limits.</strong> Request counts per guest identity, used
          only to rate-limit the service.
        </li>
      </ul>
      <h2>Advertising</h2>
      <p>
        The home pages and room lobby can show ads from Google AdSense. Google
        and its partners may use cookies or similar technologies to show ads and
        measure them, including ads based on your previous visits to this and
        other websites. Ads never receive the hidden answer or your opponent’s
        letters, which the server does not send to your browser during play.
      </p>
      <p>
        Where required, you are asked for consent before personalized ads are
        shown. You can change that choice at any time:
      </p>
      <ConsentChoices />
      <p>
        Learn how Google uses information from sites that use its services at{' '}
        <a
          href="https://policies.google.com/technologies/partner-sites"
          rel="noopener noreferrer"
          target="_blank"
        >
          policies.google.com/technologies/partner-sites
        </a>
        , and manage personalized advertising in{' '}
        <a
          href="https://adssettings.google.com"
          rel="noopener noreferrer"
          target="_blank"
        >
          Google’s Ad Settings
        </a>
        . You can also opt out of some third-party vendors’ use of cookies for
        personalized advertising at{' '}
        <a
          href="https://www.aboutads.info/choices/"
          rel="noopener noreferrer"
          target="_blank"
        >
          aboutads.info
        </a>
        .
      </p>
      <h2>Changes to this page</h2>
      <p>
        If what LetterLane stores or how it shows ads changes, this page will be
        updated first. Last updated: October 5, 2026.
      </p>
    </ContentPage>
  );
}
