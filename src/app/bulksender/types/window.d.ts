declare global {
  interface Window {
    originalAddressCount?: number;
    ethereum: {
      request: (args: any) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      isPhantom?: boolean;
      isTronLink?: boolean;
      isTrust?: boolean;
      isCoinbaseWallet?: boolean;
      isMetaMask?: boolean;
      chainId?: string;
    } | undefined;
    phantom?: {
      ethereum: {
        isPhantom: boolean;
        request: (args: any) => Promise<any>;
        on: (event: string, callback: (...args: any[]) => void) => void;
        removeListener: (event: string, callback: (...args: any[]) => void) => void;
      };
    };
  }
}

export {};