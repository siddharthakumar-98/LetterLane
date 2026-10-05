import { getAdsConfig } from '@/lib/ads-config';
import { ADS_READY_EVENT } from '@/lib/client/ads';

/** Loads AdSense once, with the H5 Games Ads queue when that product is enabled.
 * Plain server-rendered tags: AdSense rejects next/script's data-nscript attribute. */
export function AdsScript() {
  const config = getAdsConfig();
  if (!config) return null;
  return (
    <>
      {config.h5 && (
        <script
          id="adsense-h5-config"
          dangerouslySetInnerHTML={{
            __html: `window.adsbygoogle=window.adsbygoogle||[];window.adBreak=window.adConfig=function(o){window.adsbygoogle.push(o);};window.adConfig({preloadAdBreaks:'on',sound:'off',onReady:function(){window.letterlaneAdsReady=true;window.dispatchEvent(new Event('${ADS_READY_EVENT}'));}});`,
          }}
        />
      )}
      <script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.client}`}
        crossOrigin="anonymous"
        {...(config.h5 ? { 'data-ad-frequency-hint': '120s' } : {})}
        {...(config.test ? { 'data-adbreak-test': 'on' } : {})}
      />
    </>
  );
}
