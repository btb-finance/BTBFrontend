import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Apple touch icon + the square logo referenced by JSON-LD / manifest.
export default function AppleIcon() {
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
          fontSize: 116,
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
