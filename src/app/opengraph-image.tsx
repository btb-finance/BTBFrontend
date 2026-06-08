import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo/config';

export const alt = SITE.ogImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Branded social card — what shows when the link is shared on X, Discord, etc.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(135deg, #0A0A0F 0%, #1E293B 55%, #334155 100%)',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(140deg,#FFFFFF 0%, #1E293B 100%)',
              fontSize: 60,
              fontWeight: 900,
              color: '#0A0A0F',
            }}
          >
            B
          </div>
          <div style={{ marginLeft: 28, fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
            BTB Finance
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 78, fontWeight: 900, letterSpacing: -2, lineHeight: 1.05 }}>
            The first NFTs that
          </div>
          <div
            style={{
              fontSize: 78,
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 1.05,
              background: 'linear-gradient(90deg,#FFFFFF,#F59E0B)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            pay you forever.
          </div>
          <div style={{ marginTop: 26, fontSize: 30, color: 'rgba(255,255,255,0.7)' }}>
            Mint a BTB Bear · stake it · earn BTBB rewards on-chain.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', fontSize: 26, color: 'rgba(255,255,255,0.55)' }}>
          Mint &nbsp;·&nbsp; Stake &amp; Earn &nbsp;·&nbsp; Swap &nbsp;·&nbsp; btb.finance
        </div>
      </div>
    ),
    { ...size },
  );
}
