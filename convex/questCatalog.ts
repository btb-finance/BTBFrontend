/**
 * The XP quest catalog. Imported by both the Convex mutations and the /token
 * screen so the XP a card advertises is literally the XP the server awards —
 * there is no second copy of these numbers to drift.
 */

export type QuestCadence = "once" | "daily" | "weekly";
export type QuestProof = "url" | "handle" | "text" | "none";

/**
 * "auto" quests are awarded by the app itself the moment the action happens
 * on-chain; they are listed for discoverability but cannot be submitted.
 * "review" quests need a human to look at the proof link.
 */
export type QuestVerify = "auto" | "review";

export interface Quest {
  id: string;
  title: string;
  description: string;
  xp: number;
  cadence: QuestCadence;
  category: "social" | "content" | "product" | "community";
  verify: QuestVerify;
  proof: QuestProof;
  /** Placeholder shown in the proof input. */
  proofHint?: string;
  icon: string;
  color: string;
  /** Opens in a new tab when the card's action button is pressed. */
  link?: string;
}

export const QUESTS: Quest[] = [
  // ── Social ────────────────────────────────────────────────────────────────
  {
    id: "follow-x",
    title: "Follow BTB on X",
    description: "Follow @btb_finance, then paste your X profile link so we can match the follow.",
    xp: 100, cadence: "once", category: "social", verify: "review",
    proof: "handle", proofHint: "@yourhandle",
    icon: "twitter", color: "#38BDF8", link: "https://x.com/btb_finance",
  },
  {
    id: "tweet-about-btb",
    title: "Post about BTB on X",
    description: "Write your own post about BTB — what you use it for, what you like, what you'd change. Paste the post link.",
    xp: 250, cadence: "weekly", category: "social", verify: "review",
    proof: "url", proofHint: "https://x.com/…/status/…",
    icon: "twitter", color: "#38BDF8",
  },
  {
    id: "x-thread",
    title: "Write an X thread",
    description: "A real thread — 4+ posts explaining a BTB feature, your LP setup, or a walkthrough. Depth pays more than volume.",
    xp: 900, cadence: "weekly", category: "social", verify: "review",
    proof: "url", proofHint: "https://x.com/…/status/…",
    icon: "layers", color: "#38BDF8",
  },
  {
    id: "share-position",
    title: "Share a position screenshot",
    description: "Post a screenshot of a BTB position, swap, or Bear you minted. Paste the link.",
    xp: 200, cadence: "weekly", category: "social", verify: "review",
    proof: "url", proofHint: "https://x.com/…/status/…",
    icon: "image", color: "#38BDF8",
  },

  // ── Content ───────────────────────────────────────────────────────────────
  {
    id: "write-article",
    title: "Write an article",
    description: "Publish a piece about BTB on Mirror, Medium, Substack, or your own blog. Original writing only.",
    xp: 1500, cadence: "weekly", category: "content", verify: "review",
    proof: "url", proofHint: "https://mirror.xyz/…",
    icon: "doc", color: "#A78BFA",
  },
  {
    id: "make-video",
    title: "Make a video",
    description: "A YouTube walkthrough, a TikTok, a demo of the agent — anything that shows BTB actually being used.",
    xp: 2500, cadence: "weekly", category: "content", verify: "review",
    proof: "url", proofHint: "https://youtube.com/watch?v=…",
    icon: "rocket", color: "#A78BFA",
  },
  {
    id: "write-tutorial",
    title: "Write a tutorial",
    description: "A step-by-step guide: providing liquidity, setting up a managed position, using DCA. Screenshots help.",
    xp: 1800, cadence: "weekly", category: "content", verify: "review",
    proof: "url", proofHint: "Link to the published guide",
    icon: "map", color: "#A78BFA",
  },
  {
    id: "translate-docs",
    title: "Translate the docs",
    description: "Translate a docs page into your language and share it. Tell us which page and which language.",
    xp: 1200, cadence: "weekly", category: "content", verify: "review",
    proof: "url", proofHint: "Link to your translation",
    icon: "globe", color: "#A78BFA",
  },

  // ── Product ───────────────────────────────────────────────────────────────
  {
    id: "install-app",
    title: "Install the BTB app",
    description: "Add BTB to your home screen and open it. Paste a screenshot link of the installed icon.",
    xp: 300, cadence: "once", category: "product", verify: "review",
    proof: "url", proofHint: "Link to a screenshot",
    icon: "launch", color: "#52E3A4",
  },
  {
    id: "auto-swap",
    title: "Swap in the app",
    description: "Every completed swap credits XP automatically — nothing to submit.",
    xp: 100, cadence: "daily", category: "product", verify: "auto",
    proof: "none", icon: "swap", color: "#52E3A4",
  },
  {
    id: "auto-mint",
    title: "Mint a BTB Bear",
    description: "Minting credits XP automatically, per Bear.",
    xp: 1000, cadence: "daily", category: "product", verify: "auto",
    proof: "none", icon: "nft", color: "#52E3A4",
  },
  {
    id: "auto-stake",
    title: "Stake, supply, or LP",
    description: "On-chain DeFi actions tracked by the app credit XP automatically as you do them.",
    xp: 10, cadence: "daily", category: "product", verify: "auto",
    proof: "none", icon: "stake", color: "#52E3A4",
  },

  // ── Community ─────────────────────────────────────────────────────────────
  {
    id: "invite-friend",
    title: "Invite a friend",
    description: "Get someone to connect a wallet and check in. Paste their address so we can confirm they showed up.",
    xp: 400, cadence: "weekly", category: "community", verify: "review",
    proof: "text", proofHint: "0x… of the friend who joined",
    icon: "users", color: "#FFB36B",
  },
  {
    id: "report-bug",
    title: "Report a bug",
    description: "Find something broken and tell us how to reproduce it. Reproducible reports pay; vague ones don't.",
    xp: 800, cadence: "weekly", category: "community", verify: "review",
    proof: "text", proofHint: "What broke, and the steps to reproduce it",
    icon: "shield", color: "#FFB36B",
  },
  {
    id: "give-feedback",
    title: "Give product feedback",
    description: "Tell us what's confusing, missing, or slow. Specific beats polite.",
    xp: 200, cadence: "weekly", category: "community", verify: "review",
    proof: "text", proofHint: "What would you change?",
    icon: "mail", color: "#FFB36B",
  },
  {
    id: "join-discord",
    title: "Join the community",
    description: "Join the BTB Discord and say hello. Paste your Discord username.",
    xp: 100, cadence: "once", category: "community", verify: "review",
    proof: "handle", proofHint: "yourname#0000",
    icon: "discord", color: "#FFB36B",
  },
];

export const QUEST_BY_ID: Record<string, Quest> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export const CATEGORY_LABELS: Record<Quest["category"], string> = {
  social: "Social",
  content: "Create",
  product: "Use the app",
  community: "Community",
};

/** Daily check-in XP, mirrored from users.ts so the UI can advertise the ramp. */
export const CHECK_IN_XP = { start: 10, step: 2, cap: 50, weeklyMilestone: 50 };
