import type { Metadata } from 'next';
import { ContentPage } from '@/components/content-page';
import { ConsentChoices } from '@/components/consent-choices';
export const metadata: Metadata = {
  title: 'Privacy — LetterLane',
  description: 'How LetterLane handles guest identities, game data and ads.',
};
// Describes the implemented data flows; deployment-specific legal review is separate.
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
          guest session so you can rejoin your rooms. You do not need to provide
          an email address or sign in with another account. The guest identity
          is associated with your chosen display name and game activity.
        </li>
        <li>
          <strong>Game data.</strong> The display name you choose, the rooms you
          join, your accepted guesses and match results. Rooms expire after 24
          hours; starting a rematch renews that period. Expired rooms become
          inaccessible but remain stored until database cleanup removes them.
        </li>
        <li>
          <strong>Browser storage.</strong> Your guest session, your last
          display name, and a note that a room’s lobby ad has already been
          requested in this tab. Clearing site storage can prevent you from
          rejoining a room under the same guest identity.
        </li>
        <li>
          <strong>Abuse limits.</strong> Request counts per guest identity, used
          only to rate-limit the service.
        </li>
      </ul>
      <h2>Advertising</h2>
      <p>
        The home pages and room lobby can show ads from Google AdSense. Google
        and its partners may place and read cookies or use similar technologies,
        including web beacons and IP addresses, to collect information for ad
        delivery and measurement. Personalized ads may use information about
        your previous visits to this and other websites. LetterLane does not
        include your game data in ad requests. Third-party scripts run in your
        browser and may access page content; the hidden answer and your
        opponent’s letters are withheld from the browser until the round ends.
      </p>
      <p>
        Google’s European consent message lets eligible visitors choose whether
        to allow advertising cookies and personalized ads. Use the control below
        to revisit those choices. In supported US states, use Google’s “Do Not
        Sell or Share My Personal Information” link to open the opt-out message.
        If a privacy control does not load, contact us using the email below.
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
      <h2>Contact and privacy requests</h2>
      <p>
        For privacy questions or requests to access or delete game data, email{' '}
        <a href="mailto:siddukumar321@gmail.com">siddukumar321@gmail.com</a>.
        Include only the details needed to identify your request, such as a room
        code and display name. Do not send passwords or session tokens. Because
        the game uses guest identities, we may need additional information to
        verify that a request relates to your data. If you email us, we receive
        your email address and the information you choose to include so we can
        respond.
      </p>
      <h2>Changes to this page</h2>
      <p>
        If what LetterLane stores or how it shows ads changes, this page will be
        updated first. Last updated: October 5, 2026.
      </p>
    </ContentPage>
  );
}
