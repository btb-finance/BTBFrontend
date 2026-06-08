import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

// 512×512 PWA / maskable app icon.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(140deg,#FFFFFF 0%, #0F172A 70%, #1E293B 100%)',
          color: '#0A0A0F',
          fontSize: 320,
          fontWeight: 900,
          fontFamily: 'sans-serif',
        }}
      >
        B
      </div>
    ),
    { ...size },
  );
}
