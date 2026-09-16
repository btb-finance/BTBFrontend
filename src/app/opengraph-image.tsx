import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo/config';

export const alt = SITE.ogImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Branded social card: what shows when the link is shared on X, Discord, etc.
export default async function Image() {
  // The real logo, embedded as a data URL so the renderer never fetches over the network.
  const logo = await fetch(new URL('../../public/btblogo.jpg', import.meta.url)).then((r) => r.arrayBuffer()).then((b) => `data:image/jpeg;base64,${Buffer.from(b).toString('base64')}`).catch(() => null);
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
          background: 'radial-gradient(700px 500px at 100% 0%, rgba(82,227,164,0.28), transparent 60%), radial-gradient(520px 400px at 0% 100%, rgba(255,255,255,0.10), transparent 60%), #0A0A0F',
          color: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" width={96} height={96} style={{ width: 96, height: 96, borderRadius: 999 }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E5261F', fontSize: 60, fontWeight: 900, color: '#fff' }}>B</div>
          )}
          <div style={{ marginLeft: 28, fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
            BTB Finance
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 72, fontWeight: 900, letterSpacing: -2, lineHeight: 1.05 }}>
            Simulate. Add. Manage.
          </div>
          <div
            style={{
              fontSize: 78,
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 1.05,
              background: 'linear-gradient(90deg,#FFFFFF,#52E3A4)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Get paid every Friday.
          </div>
          <div style={{ marginTop: 26, fontSize: 30, color: 'rgba(255,255,255,0.7)' }}>
            The LP app that shares its revenue with the people who use it.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', fontSize: 26, color: 'rgba(255,255,255,0.55)' }}>
          Free LP simulator, discovery and management &nbsp;·&nbsp; btb.finance
        </div>
      </div>
    ),
    { ...size },
  );
}
