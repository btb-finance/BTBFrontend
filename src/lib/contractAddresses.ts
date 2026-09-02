/**
 * BTB protocol addresses — plain constants, no wallet stack.
 *
 * Split out of `wagmi.ts` (which pulls in wagmi/viem/connectors) so Convex
 * actions can import the addresses without bundling the browser wallet
 * libraries. `wagmi.ts` re-exports this, so `CONTRACTS` keeps its old import
 * path everywhere in the app.
 */
export const CONTRACTS = {
  BTB:          '0x88888888c90CD71B35830daBFD24743DbC135B51' as `0x${string}`,
  BTBB:         '0x88888880d5Ca13018D2dC11e2e4744BD91a5656f' as `0x${string}`,
  BEAR_NFT:     '0x88888888aBa934ceA0b4f0000FeA62F1397D02A0' as `0x${string}`,
  BEAR_STAKING: '0x8888888Faf81E6a98deb2B90A05B46b6E903e927' as `0x${string}`,
  OPOS:         '0x88888805E7e3d5c7FB002AD98f08250E79c298dC' as `0x${string}`,
  FLIP:         '0x8888889C878a0aE26033799517461af33a8E50a0' as `0x${string}`,
};
