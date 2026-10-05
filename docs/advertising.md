# Advertising

Branch: `init-ads`. LetterLane can show Google AdSense ads in two places:

- **Home pages (`/` and `/phrases`):** one responsive display unit in the reserved full-width `support` row below the intro and setup columns. The create-room action stays above the fold. When Google reports the unit as `unfilled`, the labelled space collapses.
- **Room lobby:** Google's own closable full-screen interstitial (H5 Games Ads, `adBreak({ type: 'start' })`) when the waiting room opens.

**Production builds include LetterLane's AdSense site code** (publisher `ca-pub-6747177342720865`, `ADSENSE_CLIENT` in `src/lib/ads-config.ts`) in the `<head>` of every page, as AdSense requires for site verification, and serve `/ads.txt`. This loads Google's tag only: the home display unit and lobby interstitial stay off until their variables are set. Development (`pnpm dev`) stays ad-free. Set `NEXT_PUBLIC_ADSENSE_CLIENT` to another publisher ID to override it, or to `off` to disable ads entirely; then no Google script loads, `/ads.txt` returns 404 and the Content-Security-Policy is unchanged. If **Auto ads** is enabled in the AdSense dashboard, Google may also place ads on its own, including on room pages; keep it off to limit ads to the placements above.

## Vendor research (October 2026)

| Vendor                                     | Fit                | Notes                                                                                                                                                                                        |
| ------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google AdSense display                     | Home pages         | Needs an approved account, a privacy policy, `ads.txt` and crawlable content.                                                                                                                |
| AdSense H5 Games Ads (Ad Placement API)    | Lobby interstitial | Google-rendered full-screen ads at natural game breaks, with a close button and frequency capping. A separate application on top of an approved AdSense account; approval is not guaranteed. |
| AdSense unit inside our own popup          | Not allowed        | AdSense placement policy prohibits ads in pop-ups and modals. The interstitial must be Google's format.                                                                                      |
| Meta Audience Network (Facebook/Instagram) | Not for web        | Stopped filling web and in-stream placements in 2020; in-app only. Facebook/Instagram are for buying user-acquisition ads, not monetizing a website.                                         |
| AdinPlay (Venatus), Playwire, Venatus      | Later              | Game-specialist networks with higher CPMs, but traffic minimums (Playwire self-service 100k+, managed 500k+, Venatus 1.5M+ monthly page views).                                              |
| AppLixir                                   | Optional           | Rewarded video for web games without a published traffic minimum.                                                                                                                            |
| Google AdMob (+ Meta via mediation)        | iOS app            | The path for `LetterLane_app/` in a later phase.                                                                                                                                             |

Sources: [H5 Games Ads](https://adsense.google.com/start/solutions/h5-games-ads/), [adBreak API](https://developers.google.com/ad-placement/apis/adbreak), [AdSense ad placement policies](https://support.google.com/adsense/answer/1346295), [Google consent requirements for publishers](https://support.google.com/adsense/answer/13554116), [Audience Network web shutdown](https://digiday.com/media/facebook-plans-shut-facebook-audience-networks-mobile-web-arm/), [network thresholds](https://www.applixir.com/adinplay-alternatives-for-web-game-developers-2026/).

## Fairness: the lobby interstitial never costs game time

Each player's clock starts when the three-second countdown ends. The interstitial is requested only while the player is **in the lobby and not yet ready**. A countdown needs that player's own **I'm ready** or **Play with bot** action, and those controls are disabled between Google's `beforeAd` and `afterAd` callbacks, so a match cannot start underneath the ad. It is requested at most once per room per browser session (`sessionStorage` key `letterlane-ad-lobby:<code>`, plus an in-memory guard when storage is unavailable). Google applies its own frequency cap (`data-ad-frequency-hint="120s"`). Rematches go straight from results to the countdown and never show it. A blocked script resolves after five seconds of silence and leaves the lobby untouched. If Google ever misses its close callback, the controls unlock after 60 seconds; the ad itself still covers the page until it is closed. No game rule, server, API, polling or database change is involved.

## Setup

1. **Domain and content.** Deploy the production site on its real domain over HTTPS (Vercel per the README) before applying; never submit a preview deployment. See the readiness checklist below.
2. **AdSense account.** Sign up at adsense.google.com, add the site, and complete review. The publisher ID `ca-pub-6747177342720865` is already built in, so the verification code is on every page of a production deployment.
3. **Display unit.** In AdSense → Ads → By ad unit, create a responsive **Display** unit and copy its numeric `data-ad-slot`.
4. **Consent (required for EEA, UK and Switzerland).** In AdSense → Privacy & messaging, publish a **European regulations** message (Google's certified, IAB TCF CMP) and a **US state regulations** message. They load with the same AdSense tag; no other vendor is needed. `/privacy` has a **Privacy and cookie settings** button that reopens the consent message.
5. **H5 Games Ads.** Apply through the H5 Games Ads sign-up form. Until approval, leave `NEXT_PUBLIC_ADSENSE_H5` unset; the home display ad still works.
6. **Environment.** Set these in Vercel (and `.env.local` to test). They are public identifiers, not secrets, and are inlined at build time, so rebuild after changing them.

   ```sh
   NEXT_PUBLIC_ADSENSE_CLIENT=  # optional: another ca-pub ID, or off
   NEXT_PUBLIC_ADSENSE_HOME_SLOT=0000000000
   NEXT_PUBLIC_ADSENSE_H5=1     # only after H5 Games Ads approval
   NEXT_PUBLIC_ADSENSE_TEST=1   # development only: requests test ads
   ```

7. **ads.txt.** Served at `/ads.txt` from the publisher ID. Confirm AdSense reports it as authorized.
8. **Privacy page.** `/privacy` is a draft. Review it for your jurisdiction and add a contact method before launch.

## AdSense readiness checklist

Checked against Google's [site connection](https://support.google.com/adsense/answer/7584263) and [content](https://support.google.com/adsense/answer/7299563) guidance:

| Requirement                                                  | LetterLane                                                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site code between `<head>` tags on pages with content        | Every production page, verified by `tests/e2e/site-pages.spec.ts`                                                                                     |
| Live, public, no login                                       | Home, Phrases, How to play, About, FAQ and Privacy need no account                                                                                    |
| Original, substantive content                                | `/how-to-play` (full rules with live-scored examples), `/about` (purpose, fair play, sources, independence), `/faq` (12 answers); each over 400 words |
| Clear navigation, no broken pages                            | Header Words/Phrases switch, footer links to all four content pages on every page, internal-link crawl in the e2e test, real 404 page                 |
| Crawler not blocked                                          | `/robots.txt` allows everything except `/room/` and `/api/`, and explicitly allows `Mediapartners-Google` site-wide                                   |
| Sitemap                                                      | `/sitemap.xml` lists the six public pages                                                                                                             |
| Privacy policy with Google ad-cookie disclosure and opt-outs | `/privacy` (draft: add a contact method and review before launch)                                                                                     |
| Consent for EEA, UK, Switzerland                             | Publish Google's European and US state messages in AdSense → Privacy & messaging                                                                      |
| ads.txt                                                      | `/ads.txt` returns `google.com, pub-6747177342720865, DIRECT, f08c47fec0942fa0`                                                                       |
| Room pages                                                   | Not monetized with display units and `noindex`; only the optional lobby interstitial                                                                  |
| Production HTTPS                                             | Provided by the hosting platform; confirm `https://<domain>/ads.txt` and `https://<domain>/robots.txt` before applying                                |

Set `SITE_URL=https://<your-domain>` in production so `robots.txt` and the sitemap always name the canonical domain; without it they use the requesting host.

## Content-Security-Policy

With ads enabled, `script-src`, `connect-src` and a new `frame-src` admit Google's AdSense, consent and H5 hosts (`*.googlesyndication.com`, `*.googleadservices.com`, `*.googletagservices.com`, `*.doubleclick.net`, `*.google.com`, `*.gstatic.com`, `*.adtrafficquality.google`), and `img-src` allows HTTPS images. `frame-ancestors 'none'`, `X-Frame-Options`, and the other headers are unchanged. Google occasionally uses country domains (for example `adservice.google.co.uk`); review console CSP reports after launch and add hosts only as needed.

## Privacy and security notes

Ad scripts run on the page and can read the DOM, as with any third-party tag. The hidden answer and opponent letters are never sent to the browser during play, so ads cannot read them. Your own guesses are visible in your lane as before. No player identifiers are passed to Google.

## Testing

- Automated: `tests/ads.test.tsx` covers configuration, CSP, `ads.txt`, the display slot, ad-break timeouts and the lobby lock. The browser suite runs with ads off.
- Manual: set the variables above with `NEXT_PUBLIC_ADSENSE_TEST=1`, run `pnpm build && pnpm start`, and check the home slot, lobby interstitial (H5 test ads), the console for CSP violations, and 1280px/390px layouts. Test ads may not fill until AdSense has reviewed the domain; localhost often receives no fill.
