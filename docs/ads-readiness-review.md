# Ads readiness review — October 5, 2026

Branch `init-ads`. A review of whether LetterLane is ready for Google AdSense review and monetization, against Google's [site connection checklist](https://support.google.com/adsense/answer/7584263) and [content guidance](https://support.google.com/adsense/answer/7299563). Setup steps are in [advertising.md](advertising.md).

## Verdict

The site meets AdSense's technical and content requirements, and the five-letter guess list licensing risk is resolved. One item remains before monetizing: publishing the **US state regulations** consent message.

## Live production check (https://letterlane.vercel.app)

| Check                                                         | Result                                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| HTTPS, and HTTP redirects to HTTPS                            | Pass (308 to `https://`)                                                                      |
| `/`, `/phrases`, `/how-to-play`, `/about`, `/faq`, `/privacy` | 200                                                                                           |
| AdSense code in `<head>`                                      | Pass, `ca-pub-6747177342720865`                                                               |
| `/ads.txt`                                                    | `google.com, pub-6747177342720865, DIRECT, f08c47fec0942fa0`                                  |
| `/robots.txt`                                                 | Allows the site and `Mediapartners-Google`; disallows `/room/` and `/api/`; names the sitemap |
| `/sitemap.xml`                                                | Lists the six public pages                                                                    |
| Unknown page                                                  | 404 with a link home                                                                          |
| Privacy contact email                                         | In `41ffe46` on `init-ads`; live after that commit is deployed                                |

## Code review findings

| Area                      | Finding                                                                                                                                                                                                               | Status                                                                                                                                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lobby interstitial timing | A lobby ad request could be queued while Google's API was still loading. Ready was locked only once the ad appeared, so a player could ready up and start the countdown, and a delayed ad could then cover the match. | **Fixed.** The request is made only after Google's `adConfig` `onReady` callback, and Ready is locked from the request until Google reports the break done (60-second safety release). If the API is not ready while the player is still unready, that lobby has no ad. Covered in `tests/ads.test.tsx`. |
| Display unit and H5 ads   | Not enabled in production: `NEXT_PUBLIC_ADSENSE_HOME_SLOT` and `NEXT_PUBLIC_ADSENSE_H5` are unset.                                                                                                                    | Expected until approval. Set them after AdSense and H5 Games Ads approval.                                                                                                                                                                                                                               |
| Ad placement policy       | No AdSense units inside custom pop-ups; rooms carry no display units; the interstitial is Google's own format.                                                                                                        | Pass                                                                                                                                                                                                                                                                                                     |
| CSP                       | Admits only Google's ad, consent and H5 hosts when ads are on.                                                                                                                                                        | Pass                                                                                                                                                                                                                                                                                                     |
| Privacy page              | Discloses guest identity, game data, browser storage, Google ad cookies and opt-outs, consent controls, and a privacy contact (`siddukumar321@gmail.com`).                                                            | Pass. Legal review for your jurisdictions is still recommended.                                                                                                                                                                                                                                          |
| Content and navigation    | Three original content pages, footer links on every page, automated link crawl and accessibility checks.                                                                                                              | Pass                                                                                                                                                                                                                                                                                                     |

## Consent messages (AdSense → Privacy & messaging)

| Message                                     | Status                                                                                                                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| European regulations (EEA, UK, Switzerland) | Published. Its privacy-policy link was corrected to `https://letterlane.vercel.app/privacy`.                                                                                                                                                                  |
| US state regulations                        | **Not yet published.** Google blocked publishing because the default layout expects a logo. Add a logo (for example `src/app/icon.jpg`), or choose a layout without one, set the privacy-policy link to `https://letterlane.vercel.app/privacy`, and publish. |

The `/privacy` **Privacy and cookie settings** button reopens the European message. Google displays the US **Do Not Sell or Share My Personal Information** link once that message is published.

## Licensing: five-letter accepted guesses

**Resolved on `init-ads`.** `src/lib/server/dictionary/allowed-guesses.json` previously held 14,856 guesses, including 14,855 words extracted from the public JavaScript of The New York Times' Wordle game, with no recorded license or permission. Single words are not protected by copyright, but a selected compilation can be, and AdSense prohibits monetizing infringing content; omitting the NYT name did not change that.

The list has been replaced with **6,829** five-letter words generated by `scripts/build-words-dictionary.py` from the pinned SCOWL release (size 70, the same ordinary-word filters as Phrases, permissive license with the notice preserved in `src/lib/server/dictionary/DICTIONARY-LICENSE.txt`). None of the extracted entries were merged back. All 825 answers are in the new list, and common openers (ADIEU, AUDIO, RAISE, ARISE, CRATE, SLANT) remain valid; very obscure guesses and the old LetterLane-only FOOEY are no longer accepted. Six- and seven-letter Words and Phrases already used SCOWL. The answer lists are LetterLane's own curated selections, documented in the source notes.

## Remaining actions

1. Publish the US state regulations message (logo or logo-free layout, privacy link, publish).
2. Merge `init-ads` and deploy, so the privacy contact, lobby-ad fix and SCOWL guess list are live.
3. After approval, set `NEXT_PUBLIC_ADSENSE_HOME_SLOT` and, once H5 Games Ads is approved, `NEXT_PUBLIC_ADSENSE_H5=1`.
