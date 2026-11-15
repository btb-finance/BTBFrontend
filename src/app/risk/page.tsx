import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { LegalPage, List, P, Section } from '../legal-shell';

export const metadata: Metadata = buildMetadata({
  title: 'Risks',
  description: 'What can go wrong when you provide liquidity with BTB Finance: impermanent loss, smart contracts, automation, data and scams.',
  path: '/risk',
});

export default function RiskPage() {
  return (
    <LegalPage
      eyebrow="Risks"
      title="What can go wrong"
      lead="Providing liquidity can lose money, and crypto carries risks that banks do not. Read this before you add liquidity, use the auto wallet or top up your BTB balance."
    >
      <Section title="Liquidity providing">
        <List items={[
          <><strong>Impermanent loss.</strong> When prices move, an LP position can be worth less than simply holding the two tokens. Fees may not make up for it.</>,
          <><strong>Out of range.</strong> A concentrated position earns fees only while the price is inside its range. Outside it, it earns nothing and holds only one of the two tokens.</>,
          <><strong>Token risk.</strong> Any token, including BTB, can lose most or all of its value. Some tokens have hidden taxes, can be frozen, or can be drained by their creators.</>,
        ]} />
      </Section>

      <Section title="Smart contracts">
        <List items={[
          <><strong>The auto wallet is not audited.</strong> It is designed so that only you can withdraw, but a bug could still lose funds.</>,
          'The DEXes, pools, gauges and farms BTB connects to are run by others. Their contracts can fail, be hacked, or change their rules.',
          'Approvals you sign let a contract move your tokens. Only sign what you expect.',
        ]} />
      </Section>

      <Section title="Automation">
        <List items={[
          'Auto-rebalance can be late, skip a move, or move at a bad moment, for example during a fast price swing, when a network is busy, or when a data provider is down.',
          'Each rebalance costs network gas and may realise a loss against holding. Frequent rebalancing can cost more than it earns.',
          'Swaps can get a worse price than expected (slippage), up to the limit you set.',
          'Paid automation pauses when your BTB balance runs out.',
        ]} />
      </Section>

      <Section title="Numbers and advice">
        <List items={[
          'APRs, smart LP results, scans and simulations are measured or estimated from past data. Past results do not predict future results.',
          'Data can be late, incomplete or wrong. Check before you act.',
          'Nothing on BTB, including the AI agent, is financial advice.',
        ]} />
      </Section>

      <Section title="Your BTB balance and rewards">
        <List items={[
          'BTB topped up in the app can only be spent on BTB services. It cannot be withdrawn.',
          'Weekly rewards depend on trading activity and on how many people earn points. They change every week, can be zero, and the program can change or end.',
        ]} />
      </Section>

      <Section title="Scams and security">
        <List items={[
          'BTB will never ask for your seed phrase or private key, and the team never messages you first.',
          'Use only btb.finance. Fake sites, tokens and support accounts copy BTB\'s name.',
          'If you lose your wallet keys, nobody, including BTB, can recover your funds.',
        ]} />
      </Section>

      <Section title="Rules and regions">
        <P>Crypto rules differ by country and keep changing. A change in the law could limit what BTB can offer where you live. You are responsible for using BTB lawfully.</P>
      </Section>

      <Section title="In short">
        <P>Start small. Only use money you can afford to lose. Check every range, every transaction and every number before you act.</P>
      </Section>
    </LegalPage>
  );
}
