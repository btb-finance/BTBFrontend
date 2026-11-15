import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { styles } from '../vs/shell';
import { CONTACT, LegalPage, List, P, Section } from '../legal-shell';

export const metadata: Metadata = buildMetadata({
  title: 'Privacy',
  description: 'What BTB Finance stores about you: your wallet address and what you do in the app. No names, no emails, no selling data.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="What we store, and why"
      lead="BTB has no accounts, names or emails. You are a wallet address. Here is everything we keep about that address, and who else sees it."
    >
      <Section title="What we store">
        <List items={[
          <><strong>Your wallet address</strong> and public blockchain data about it (balances, positions, transactions). This data is public on the blockchain anyway.</>,
          <><strong>What you do in the app:</strong> your BTB balance, top-ups and charges, auto wallet settings, alerts, position labels, check-ins, quests, points and weekly rewards.</>,
          <><strong>AI agent chats:</strong> the messages you send the agent and its answers, so the conversation can continue.</>,
          <><strong>Quest proofs:</strong> the links or handles you submit for a quest.</>,
          <><strong>Check-in protection:</strong> to stop one person from using many wallets, we keep a one-way hash of your IP address and network, a random id for your browser, and a hash of browser traits. We cannot turn these back into your IP address.</>,
          <><strong>Push alerts:</strong> if you turn them on, the browser&apos;s push address and its browser name.</>,
        ]} />
      </Section>

      <Section title="What we do not do">
        <List items={[
          'We do not ask for your name, email or phone number.',
          'We do not sell your data or use it for advertising.',
          'We never ask for your seed phrase or private key.',
        ]} />
      </Section>

      <Section title="Who else sees it">
        <List items={[
          'Our backend host (Convex) stores the data above.',
          'Cloudflare runs our website analytics (counts of visits, without cookies) and the check-in bot protection.',
          'Messages to the AI agent are sent to an AI model provider to write the answer.',
          'Blockchain nodes and data providers receive your wallet address when the app reads your balances and positions.',
          'Your wallet provider and the DEXes you use have their own privacy policies.',
        ]} />
      </Section>

      <Section title="Your choices">
        <P>You can use most of BTB without connecting a wallet. You can turn off push alerts in your browser. To ask what we hold about your address, or to delete your agent chats and other app records, email <a href={`mailto:${CONTACT}`} style={styles.link}>{CONTACT}</a> with your wallet address (we may ask you to sign a message to prove it is yours). Records on the blockchain cannot be deleted by anyone, and deleting app records ends any BTB balance, points or rewards tied to them.</P>
      </Section>
    </LegalPage>
  );
}
