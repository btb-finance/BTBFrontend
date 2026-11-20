// Server-rendered first view of Home (see ../RoutePreview.tsx): the "Holding BTB paid" card as a visitor without a
// wallet first sees it, built from the same pieces as TokenPanel (../home). The figures load in the app, so they show
// the same '...' the live card shows until its data arrives.
import { BTB_PER_BONUS_XP, epochIdAt } from '../../../convex/xpRules';
import { Button } from '../Button';
import { btb } from '../design-tokens';
import { EpochTimer } from '../home/EpochTimer';
import { BigApr, heroCardStyle, LABEL_STYLE, StatTile } from '../home/heroParts';

function HeroCard({ mobile }: { mobile: boolean }) {
  return (
    <div style={heroCardStyle(mobile)}>
      <div>
        <div style={LABEL_STYLE}>Holding BTB paid</div>
        <div style={{ marginTop: 6 }}><BigApr text="..." mobile={mobile}/></div>
        <div style={{ color: btb.textMuted, fontSize: 13.5, lineHeight: 1.5, marginTop: 8, maxWidth: 560 }}>
          BTB shares its weekly revenue with the people who hold and use it. Check in daily, every {BTB_PER_BONUS_XP} BTB you hold earns XP, and every Friday XP becomes BTB.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: mobile ? 6 : 9 }}>
        <StatTile row={mobile} label="This week's pot" value="..."/>
        <StatTile row={mobile} label="Paid last week" value="..." sub={mobile ? undefined : 'wallets'}/>
      </div>
      <EpochTimer epochId={epochIdAt(Date.now())} bare mobile={mobile}/>
      <Button size="md" variant="success" icon="wallet">Connect and check in</Button>
    </div>
  );
}

export function HomePreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="btb-phone-only"><HeroCard mobile/></div>
      <div className="btb-desktop-only"><HeroCard mobile={false}/></div>
    </div>
  );
}
