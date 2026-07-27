'use client';
import { useState } from 'react';
import { Glass } from '../Glass';
import { SectionHeader } from '../SectionHeader';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { Screen } from '../Screen';
import { Badge } from '../Badge';
import { btb } from '../design-tokens';
import { CONTRACTS } from '../../lib/wagmi';
import { QuestBoard } from '../QuestBoard';

const BTB_ADDRESS = CONTRACTS.BTB;
const shortAddr = `${BTB_ADDRESS.slice(0, 6)}…${BTB_ADDRESS.slice(-4)}`;

// The whole mechanism, one line each. Anything that needs a paragraph to
// explain doesn't belong on this page.
const FACTS = [
  'Earn XP for anything that adds value — post, write, film, build, report, or just use the app.',
  'Enter once a week. Entering stakes the XP you earned that week.',
  'Friday 00:00 UTC the pot is split between everyone who entered, by XP share.',
  'The pot is the 1% OPOS transfer tax that week collected. Nothing is minted to pay you.',
  'BTB arrives in your wallet automatically. No claim, no gas.',
  'Off-chain proof is checked by a human. Farmed or AI-slop submissions get rejected.',
];

export function TokenScreen({ onSwap, address, onConnect }: { onSwap: () => void; address?: string; onConnect: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard?.writeText(BTB_ADDRESS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };

  return (
    <Screen gap={20}>
      {/* title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
            Do the work. Get paid in BTB.
          </div>
          <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 2 }}>
            Revenue split every Friday between the people who showed up.
          </div>
        </div>
        <Badge color="#52E3A4" bg="rgba(82,227,164,0.15)" border="none" style={{ flexShrink: 0 }}>PAID FRIDAYS</Badge>
      </div>

      {/* XP, the weekly entry, and every task */}
      <QuestBoard address={address} onConnect={onConnect}/>

      {/* the rules, one line each */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SectionHeader title="How it works"/>
        <Glass padding={16} radius={20}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {FACTS.map(fact => (
              <div key={fact} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Icon name="check" size={15} color={btb.green}/>
                <span style={{ color: btb.textMuted, fontSize: 13, lineHeight: 1.55, flex: 1 }}>{fact}</span>
              </div>
            ))}
          </div>
        </Glass>
      </div>

      {/* contract */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button
          size="sm" variant="successSoft" fullWidth={false}
          icon={copied ? 'check' : 'wallet'}
          onClick={copyAddress}
          title="Copy contract address"
          style={{ fontFamily: 'monospace', letterSpacing: 0 }}
        >
          {copied ? 'Copied' : shortAddr}
        </Button>
        <Button size="sm" variant="successSoft" fullWidth={false} icon="swap" onClick={onSwap}>
          Get BTB
        </Button>
        <Button size="sm" variant="successSoft" fullWidth={false} icon="launch" href={`https://etherscan.io/token/${BTB_ADDRESS}`} target="_blank">
          Etherscan
        </Button>
        <Button size="sm" variant="successSoft" fullWidth={false} icon="twitter" href="https://x.com/BTB_Finance" target="_blank">
          Follow
        </Button>
        <Button size="sm" variant="successSoft" fullWidth={false} icon="discord" href="https://discord.gg/bqFEPA56Tc" target="_blank">
          Discord
        </Button>
      </div>

    </Screen>
  );
}
