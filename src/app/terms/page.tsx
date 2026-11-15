import type { Metadata } from 'next';
import Link from 'next/link';
import { buildMetadata } from '@/lib/seo/metadata';
import { styles } from '../vs/shell';
import { CONTACT, LegalPage, List, P, Section } from '../legal-shell';

export const metadata: Metadata = buildMetadata({
  title: 'Terms of use',
  description: 'The rules for using BTB Finance: your wallet stays yours, the auto wallet, the BTB balance, weekly rewards, and what BTB is not.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of use"
      lead="Plain rules for using BTB Finance. By connecting a wallet or using any part of btb.finance, you agree to them. Please read the Risks page too."
    >
      <Section title="1. What BTB is">
        <P>BTB Finance (&quot;BTB&quot;, &quot;we&quot;) is software at btb.finance that helps liquidity providers find pools, measure results and manage positions on decentralised exchanges (DEXes). BTB is not a bank, broker, exchange, custodian or financial adviser. Trades and liquidity go to third party DEXes and blockchains that BTB does not control.</P>
      </Section>

      <Section title="2. Who may use it">
        <List items={[
          'You must be at least 18 and able to agree to these terms.',
          'You must not be a person named on a sanctions list (such as those of the UN, US, UK or EU), or be in or act for a country or region under comprehensive sanctions.',
          'You are responsible for following the laws where you live, including any tax on what you earn or trade.',
          'We may limit or stop access for anyone, or from any place, at any time.',
        ]} />
      </Section>

      <Section title="3. Your wallet stays yours">
        <List items={[
          'You connect your own wallet. BTB never holds your keys and will never ask for your seed phrase or private key.',
          'Every transaction is signed by you, in your wallet. Check what you sign. Blockchain transactions cannot be reversed.',
          'Your tokens and LP positions stay in your own wallet or your own auto wallet.',
        ]} />
      </Section>

      <Section title="4. The auto wallet">
        <P>The auto wallet is a smart contract wallet that you own. When you move a position into it, BTB&apos;s automation can rebalance, collect, compound and stake it within the rules you set. It is designed so that only you can withdraw, and withdrawals always go to you. You can pause it or take everything out at any time.</P>
        <P><strong>The auto wallet has not been audited.</strong> Automation can fail, be late or make a move you would not have made (see Risks). Start small, and only use amounts you can afford to lose.</P>
      </Section>

      <Section title="5. The BTB balance and paid services">
        <List items={[
          'Some services cost BTB: token scans, auto-rebalance checks and actions, alerts and extra agent messages. Current prices are shown in the app and may change.',
          'You can top up a BTB balance in the app. The balance can only be used for BTB services. It cannot be withdrawn, sent to another wallet or refunded, and it has no value outside the app.',
          'A check, rebalance or scan that fails is not charged. When your balance runs out, paid services pause.',
        ]} />
      </Section>

      <Section title="6. Weekly rewards">
        <List items={[
          'Each week, a pool of BTB funded by BTB\'s revenue is shared among people who used the app, in proportion to the points they earned that week. Holding BTB adds bonus points to daily check-ins.',
          'The amount changes every week and can be zero. Rewards are not interest, a dividend or a return on any investment, and nothing is promised.',
          'We may exclude wallets we believe are abusing the program, for example one person using many wallets, and we decide how points are counted.',
          'A reward that is not claimed before the next week settles goes back into the pool.',
          'We may change, pause or end the program at any time.',
        ]} />
      </Section>

      <Section title="7. Data, scans and the AI agent">
        <P>APRs, scans, grades, smart LP rankings, simulations and AI agent answers are information, not advice. Past results do not predict future results, and data can be late or wrong. Make your own decisions.</P>
      </Section>

      <Section title="8. What you must not do">
        <List items={[
          'Break the law, or use BTB for money laundering or to avoid sanctions.',
          'Attack, overload, or try to exploit the app, its contracts or other users.',
          'Use bots, scripts or many wallets to collect points or rewards.',
          'Pretend to be BTB or its team.',
        ]} />
      </Section>

      <Section title="9. No guarantees">
        <P>BTB is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind. To the fullest extent the law allows, BTB and the people behind it are not liable for any loss, including lost tokens, lost profit, or losses caused by smart contracts, DEXes, blockchains, automation, data errors or outages. Where liability cannot be excluded, it is limited to the BTB you paid for services in the last three months.</P>
      </Section>

      <Section title="10. Changes and contact">
        <P>We may update these terms. The date at the top shows the latest version, and using BTB after a change means you accept it. Questions: <a href={`mailto:${CONTACT}`} style={styles.link}>{CONTACT}</a>. Read the <Link href="/risk" style={styles.link}>Risks</Link> and <Link href="/privacy" style={styles.link}>Privacy</Link> pages as well.</P>
      </Section>
    </LegalPage>
  );
}
