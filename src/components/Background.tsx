'use client';
import { PALETTE_PRESETS, PaletteKey } from './design-tokens';

export function Background({ palette = 'ember' }: { palette?: PaletteKey }) {
  const p = PALETTE_PRESETS[palette] || PALETTE_PRESETS.ember;
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `linear-gradient(165deg, ${p.colors[0]} 0%, ${p.colors[1]} 100%)`,
      overflow: 'hidden',
    }}>
      <div className="orb1" style={{
        position: 'absolute', top: '-15%', left: '-20%',
        width: '70%', height: '60%', borderRadius: '50%',
        background: `radial-gradient(circle, ${p.colors[2]}AA 0%, transparent 65%)`,
        filter: 'blur(40px)',
      }}/>
      <div className="orb2" style={{
        position: 'absolute', top: '40%', right: '-25%',
        width: '80%', height: '70%', borderRadius: '50%',
        background: `radial-gradient(circle, ${p.colors[3]}99 0%, transparent 65%)`,
        filter: 'blur(50px)',
      }}/>
      <div className="orb3" style={{
        position: 'absolute', bottom: '-20%', left: '15%',
        width: '70%', height: '55%', borderRadius: '50%',
        background: `radial-gradient(circle, ${p.colors[2]}77 0%, transparent 65%)`,
        filter: 'blur(60px)',
      }}/>
    </div>
  );
}
