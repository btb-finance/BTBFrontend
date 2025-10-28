/**
 * EIP-6963: Multi Injected Provider Discovery
 * https://eips.ethereum.org/EIPS/eip-6963
 */

import { EIP1193Provider } from 'viem';

/**
 * Represents the assets used for displaying a wallet
 */
export interface EIP6963ProviderInfo {
  /** Unique identifier for the wallet */
  uuid: string;
  /** Human-readable name of the wallet */
  name: string;
  /** URL to the wallet's icon (SVG, PNG, or WebP) */
  icon: string;
  /** Reverse DNS name of the wallet provider */
  rdns: string;
}

/**
 * The provider detail object containing the provider and its metadata
 */
export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
}

/**
 * Event dispatched by wallets to announce their presence
 */
export interface EIP6963AnnounceProviderEvent extends CustomEvent {
  type: 'eip6963:announceProvider';
  detail: EIP6963ProviderDetail;
}

/**
 * Event dispatched by dApps to request wallet announcements
 */
export interface EIP6963RequestProviderEvent extends Event {
  type: 'eip6963:requestProvider';
}

/**
 * Augment the WindowEventMap to include EIP-6963 events
 */
declare global {
  interface WindowEventMap {
    'eip6963:announceProvider': EIP6963AnnounceProviderEvent;
    'eip6963:requestProvider': EIP6963RequestProviderEvent;
  }
}

/**
 * Store for discovered providers
 */
export interface EIP6963ProvidersMapType {
  [uuid: string]: EIP6963ProviderDetail;
}
