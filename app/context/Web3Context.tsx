'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { connectWallet, getWeb3Provider } from '../utils/web3';

interface Web3ContextType {
    account: string | null;
    signer: ethers.Signer | null;
    connecting: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
}

const Web3Context = createContext<Web3ContextType>({
    account: null,
    signer: null,
    connecting: false,
    connect: async () => {},
    disconnect: () => {},
});

export const Web3Provider = ({ children }: { children: React.ReactNode }) => {
    const [account, setAccount] = useState<string | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [connecting, setConnecting] = useState(false);

    const connect = async () => {
        try {
            setConnecting(true);
            const signer = await connectWallet();
            const address = await signer.getAddress();
            setSigner(signer);
            setAccount(address);
        } catch (error) {
            console.error('Error connecting:', error);
        } finally {
            setConnecting(false);
        }
    };

    const disconnect = () => {
        setSigner(null);
        setAccount(null);
    };

    useEffect(() => {
        const checkConnection = async () => {
            const provider = getWeb3Provider();
            if (provider) {
                try {
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts.length > 0) {
                        const signer = await provider.getSigner();
                        setSigner(signer);
                        setAccount(accounts[0]);
                    }
                } catch (error) {
                    console.error('Error checking connection:', error);
                }
            }
        };

        checkConnection();

        const handleAccountsChanged = (accounts: string[]) => {
            if (accounts.length > 0) {
                setAccount(accounts[0]);
            } else {
                disconnect();
            }
        };

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            }
        };
    }, []);

    return (
        <Web3Context.Provider value={{ account, signer, connecting, connect, disconnect }}>
            {children}
        </Web3Context.Provider>
    );
};

export const useWeb3 = () => useContext(Web3Context);
