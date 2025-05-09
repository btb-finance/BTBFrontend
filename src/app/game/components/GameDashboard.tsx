'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from './GameContext';
import { BEAR_HUNTER_ECOSYSTEM_ADDRESS as GAME_CONTRACT_ADDRESS, BEAR_NFT_ADDRESS } from '../addresses';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import HunterCard from './HunterCard';
import DepositBear from './DepositBear';
import RedeemBear from './RedeemBear';

export default function GameDashboard() {
  const { loading, hunters, mimoBalance, isAddressProtected, feedHunter, hunt, refreshData, error, gameContract } = useGame();
  const { provider, address, connectWallet } = useWalletConnection();
  
  const [showDeposit, setShowDeposit] = useState(false);
  const [activeTab, setActiveTab] = useState('hunters');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  
  const [connectionState, setConnectionState] = useState({
    hasProvider: false,
    hasAddress: false,
    hasContract: false,
  });

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Update notification on error
  useEffect(() => {
    if (error) {
      setNotification({
        type: 'error',
        message: error,
      });
    }
  }, [error]);
  
  // Update connection state for debugging
  useEffect(() => {
    setConnectionState({
      hasProvider: !!provider,
      hasAddress: !!address,
      hasContract: !!gameContract,
    });
  }, [provider, address, gameContract]);

  // Handle hunter actions
  const handleFeed = async (hunterId: number) => {
    try {
      await feedHunter(hunterId);
      setNotification({
        type: 'success',
        message: `Successfully fed Hunter #${hunterId}`,
      });
    } catch (err) {
      // Error is handled by the context
    }
  };

  const handleHunt = async (hunterId: number) => {
    try {
      await hunt(hunterId);
      setNotification({
        type: 'success',
        message: `Successfully hunted with Hunter #${hunterId}`,
      });
    } catch (err) {
      // Error is handled by the context
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Game Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-blue-100 dark:border-blue-800/30 overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute inset-0 overflow-hidden opacity-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" className="text-btb-primary dark:text-blue-400">
              <defs>
                <pattern id="gamePattern" patternUnits="userSpaceOnUse" width="100" height="100" patternTransform="scale(2) rotate(0)">
                  <path d="M50 0A50 50 0 0 1 100 50 50 50 0 0 1 50 100 50 50 0 0 1 0 50 50 50 0 0 1 50 0" fill="none" stroke="currentColor" strokeWidth="1"/>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1"/>
                  <path d="M50 10A40 40 0 0 1 90 50 40 40 0 0 1 50 90 40 40 0 0 1 10 50 40 40 0 0 1 50 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#gamePattern)"/>
            </svg>
          </div>
          
          <div className="relative p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <div className="flex items-center">
                  <div className="bg-gradient-to-br from-btb-primary to-blue-600 text-white p-3 rounded-xl shadow-lg mr-5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13 7H7v6h6V7z" />
                      <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-btb-primary to-blue-600 dark:from-btb-primary-light dark:to-blue-400">
                      MiMo Game
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      Hunt, earn, and grow your digital ecosystem
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                {/* MiMo Balance */}
                <motion.div 
                  className="bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-5 border border-blue-100 dark:border-blue-800/30 min-w-[220px] shadow-md hover:shadow-lg transition-shadow"
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                      </svg>
                      Your MiMo Balance
                    </div>
                  </div>
                  <div className="flex items-baseline">
                    <div className="text-3xl font-bold text-btb-primary dark:text-btb-primary-light mr-2">
                      {loading ? (
                        <div className="flex items-center">
                          <div className="mr-2 relative h-6 w-6">
                            <motion.div 
                              className="absolute inset-0 border-2 border-btb-primary/20 rounded-full"
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />
                            <motion.div 
                              className="absolute inset-0 border-2 border-transparent border-t-btb-primary border-l-btb-primary rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            />
                          </div>
                          <motion.span 
                            className="text-xl"
                            animate={{ 
                              opacity: [0.7, 1, 0.7],
                            }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            Loading
                            <motion.span
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity, repeatType: "loop" }}
                            >...</motion.span>
                          </motion.span>
                        </div>
                      ) : (
                        parseFloat(mimoBalance).toLocaleString()
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">MiMo</div>
                  </div>
                </motion.div>
                
                {/* Protection Status */}
                <motion.div 
                  className={`rounded-xl p-5 border min-w-[220px] shadow-md hover:shadow-lg transition-shadow ${
                    isAddressProtected 
                      ? 'bg-gradient-to-b from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-100 dark:border-green-800/30' 
                      : 'bg-gradient-to-b from-red-50 to-pink-50 dark:from-red-900/30 dark:to-pink-900/30 border-red-100 dark:border-red-800/30'
                  }`}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 ${isAddressProtected ? 'text-green-500' : 'text-red-500'}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Protection Status
                    </div>
                  </div>
                  <div className="flex items-center">
                    <motion.div 
                      className={`h-4 w-4 rounded-full mr-3 flex items-center justify-center ${
                        isAddressProtected 
                          ? 'bg-green-500 ring-2 ring-green-200 dark:ring-green-500/30' 
                          : 'bg-red-500 ring-2 ring-red-200 dark:ring-red-500/30'
                      }`}
                      animate={{ 
                        boxShadow: isAddressProtected 
                          ? ['0 0 0 rgba(74, 222, 128, 0)', '0 0 0 6px rgba(74, 222, 128, 0.2)', '0 0 0 rgba(74, 222, 128, 0)'] 
                          : ['0 0 0 rgba(248, 113, 113, 0)', '0 0 0 6px rgba(248, 113, 113, 0.2)', '0 0 0 rgba(248, 113, 113, 0)']
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {isAddressProtected && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </motion.div>
                    <div className="text-lg font-bold">
                      {loading ? (
                        <div className="flex items-center">
                          <div className="relative mr-2 h-4 w-4">
                            <motion.div 
                              className="absolute inset-0 rounded-full"
                              style={{ 
                                background: "conic-gradient(transparent 0deg, transparent 280deg, currentColor 280deg, currentColor 360deg)"
                              }}
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                            />
                            <motion.div 
                              className="absolute inset-0.5 bg-white dark:bg-gray-800 rounded-full"
                            />
                          </div>
                          <motion.span
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            Checking
                            <motion.span
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >...</motion.span>
                          </motion.span>
                        </div>
                      ) : (
                        <span className={isAddressProtected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {isAddressProtected ? 'Protected' : 'Not Protected'}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="mt-8 flex flex-wrap gap-4">
              <motion.button
                onClick={() => {
                  setShowDeposit(true);
                  setActiveTab('deposit');
                }}
                whileHover={{ scale: 1.03, boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.4)" }}
                whileTap={{ scale: 0.97 }}
                className="bg-gradient-to-r from-btb-primary to-blue-600 text-white py-3 px-6 rounded-xl shadow-lg flex items-center font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                Deposit BEAR NFT
              </motion.button>
              
              <motion.button
                onClick={() => setActiveTab('redeem')}
                whileHover={{ scale: 1.03, boxShadow: "0 10px 25px -5px rgba(5, 150, 105, 0.4)" }}
                whileTap={{ scale: 0.97 }}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-6 rounded-xl shadow-lg flex items-center font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Redeem BEAR NFT
              </motion.button>
              
              <motion.button
                onClick={refreshData}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-3 px-6 rounded-xl shadow-md flex items-center font-medium border border-gray-200 dark:border-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Refresh Data
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`mb-6 p-4 rounded-xl shadow-lg flex items-start ${
            notification.type === 'success'
              ? 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 border border-green-200 dark:border-green-800/50 text-green-800 dark:text-green-200'
              : 'bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/40 dark:to-pink-900/40 border border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-200'
          }`}
        >
          <div className={`rounded-full p-2 mr-3 flex-shrink-0 ${
            notification.type === 'success'
              ? 'bg-green-200 dark:bg-green-800'
              : 'bg-red-200 dark:bg-red-800'
          }`}>
            {notification.type === 'success' ? (
              <svg className="h-5 w-5 text-green-600 dark:text-green-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-red-600 dark:text-red-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div>
            <div className="font-medium mb-1">
              {notification.type === 'success' ? 'Success!' : 'Error!'}
            </div>
            <div className="text-sm">
              {notification.message}
            </div>
          </div>
          
          <button 
            onClick={() => setNotification(null)} 
            className="ml-auto p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </motion.div>
      )}
      
      {/* Connection Status Panel */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-blue-100 dark:border-blue-800/30 overflow-hidden"
      >
        <div className="bg-gradient-to-r from-btb-primary via-blue-600 to-indigo-600 p-4 text-white relative overflow-hidden">
          <div className="absolute inset-0 flex justify-center items-center overflow-hidden opacity-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" className="text-white">
              <path d="M100,0 L100,400 M200,0 L200,400 M300,0 L300,400 M0,100 L400,100 M0,200 L400,200 M0,300 L400,300" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <h3 className="font-bold text-xl flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
              </svg>
              Connection Status
            </h3>
            <span className="text-sm bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
              Base Sepolia Testnet
            </span>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <motion.div 
              className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden"
              whileHover={{ y: -3, boxShadow: "0 12px 24px -6px rgba(0, 0, 0, 0.1)" }}
              transition={{ duration: 0.2 }}
            >
              <div className={`${connectionState.hasProvider ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-pink-500'} h-2`}></div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    Wallet Provider
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${connectionState.hasProvider ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'}`}>
                    {connectionState.hasProvider ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
                <div className="font-semibold flex items-center">
                  {connectionState.hasProvider ? (
                    <svg className="w-5 h-5 text-green-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  {connectionState.hasProvider ? 'MetaMask/Wallet' : 'No Provider Found'}
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden"
              whileHover={{ y: -3, boxShadow: "0 12px 24px -6px rgba(0, 0, 0, 0.1)" }}
              transition={{ duration: 0.2 }}
            >
              <div className={`${connectionState.hasAddress ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-pink-500'} h-2`}></div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v-1l1-1 1-1-.257-.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                    </svg>
                    Wallet Address
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${connectionState.hasAddress ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'}`}>
                    {connectionState.hasAddress ? 'Available' : 'Not Available'}
                  </div>
                </div>
                {address ? (
                  <div className="text-xs font-mono bg-gray-100 dark:bg-gray-900/80 py-2 px-3 rounded-lg truncate border border-gray-200 dark:border-gray-800 shadow-inner flex items-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                    {address}
                  </div>
                ) : (
                  <div className="font-semibold flex items-center">
                    <svg className="w-5 h-5 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    No Address Connected
                  </div>
                )}
              </div>
            </motion.div>
            
            <motion.div 
              className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden"
              whileHover={{ y: -3, boxShadow: "0 12px 24px -6px rgba(0, 0, 0, 0.1)" }}
              transition={{ duration: 0.2 }}
            >
              <div className={`${connectionState.hasContract ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-red-400 to-pink-500'} h-2`}></div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                    Game Contract
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full ${connectionState.hasContract ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'}`}>
                    {connectionState.hasContract ? 'Connected' : 'Not Connected'}
                  </div>
                </div>
                <div className="font-semibold flex items-center">
                  {connectionState.hasContract ? (
                    <svg className="w-5 h-5 text-green-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  {connectionState.hasContract ? 'MiMo Game Ready' : 'Contract Unavailable'}
                </div>
              </div>
            </motion.div>
          </div>
          
          <div className="flex flex-wrap gap-4 mb-6">
            <motion.button 
              onClick={connectWallet}
              whileHover={{ scale: 1.03, boxShadow: "0 8px 20px -4px rgba(59, 130, 246, 0.5)" }}
              whileTap={{ scale: 0.97 }}
              className="bg-gradient-to-r from-btb-primary to-blue-600 text-white px-5 py-2.5 rounded-xl shadow-lg font-medium flex items-center"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 3.5H7C4 3.5 2 5 2 8.5V15.5C2 19 4 20.5 7 20.5H17C20 20.5 22 19 22 15.5V8.5C22 5 20 3.5 17 3.5ZM8 12.5H6C5.59 12.5 5.25 12.16 5.25 11.75C5.25 11.34 5.59 11 6 11H8C8.41 11 8.75 11.34 8.75 11.75C8.75 12.16 8.41 12.5 8 12.5ZM13 18.5H11C9.9 18.5 9 17.6 9 16.5V7.5C9 6.4 9.9 5.5 11 5.5H13C14.1 5.5 15 6.4 15 7.5V16.5C15 17.6 14.1 18.5 13 18.5ZM18 12.5H16C15.59 12.5 15.25 12.16 15.25 11.75C15.25 11.34 15.59 11 16 11H18C18.41 11 18.75 11.34 18.75 11.75C18.75 12.16 18.41 12.5 18 12.5Z" fill="currentColor"/>
              </svg>
              Connect Wallet
            </motion.button>
            
            <motion.button 
              onClick={refreshData}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-xl shadow-lg font-medium flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Data
            </motion.button>
            
            <motion.button 
              onClick={() => {
                if (window.ethereum) {
                  window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: '0x14a34', // 84532 in hex
                      chainName: 'Base Sepolia Testnet',
                      nativeCurrency: {
                        name: 'ETH',
                        symbol: 'ETH',
                        decimals: 18
                      },
                      rpcUrls: ['https://sepolia.base.org'],
                      blockExplorerUrls: ['https://sepolia.basescan.org']
                    }]
                  });
                }
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-2.5 rounded-xl shadow-lg font-medium flex items-center"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.01 2.92L18.91 5.5C20.61 6.29 20.61 7.53 18.91 8.31L13.01 10.91C12.34 11.2 11.24 11.2 10.57 10.91L4.67 8.31C2.97 7.53 2.97 6.29 4.67 5.5L10.57 2.92C11.24 2.63 12.34 2.63 13.01 2.92Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 11C3 11.84 3.63 12.81 4.4 13.15L11.19 16.17C11.71 16.4 12.3 16.4 12.81 16.17L19.6 13.15C20.37 12.81 21 11.84 21 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 16C3 16.93 3.55 17.77 4.4 18.15L11.19 21.17C11.71 21.4 12.3 21.4 12.81 21.17L19.6 18.15C20.45 17.77 21 16.93 21 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Switch to Base Sepolia
            </motion.button>
          </div>
          
          <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 rounded-xl text-xs text-gray-600 dark:text-gray-400 font-mono border border-gray-200 dark:border-gray-700 shadow-inner">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="flex items-center">
                  <div className="bg-blue-100 dark:bg-blue-900/60 rounded-lg p-1 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-500">Game Contract:</span>
                    <div className="truncate text-gray-800 dark:text-gray-300 flex items-center">
                      <a 
                        href={`https://sepolia.basescan.org/address/${GAME_CONTRACT_ADDRESS}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[120px] sm:max-w-full"
                      >
                        {GAME_CONTRACT_ADDRESS}
                      </a>
                      <a 
                        href={`https://www.aerodrome.finance/pool/add/base-sepolia`} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                      >
                        Add Liquidity
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="flex items-center">
                  <div className="bg-amber-100 dark:bg-amber-900/60 rounded-lg p-1 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600 dark:text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-500">BEAR NFT Contract:</span>
                    <div className="truncate text-gray-800 dark:text-gray-300 flex items-center">
                      <a 
                        href={`https://sepolia.basescan.org/address/${BEAR_NFT_ADDRESS}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[120px] sm:max-w-full"
                      >
                        {BEAR_NFT_ADDRESS}
                      </a>
                      <a 
                        href={`https://testnets.opensea.io/assets/base-sepolia/${BEAR_NFT_ADDRESS}`} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                      >
                        View NFTs
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-3 bg-white/50 dark:bg-black/20 p-2 rounded-lg border border-gray-200 dark:border-gray-800 flex items-center">
              <div className="bg-green-100 dark:bg-green-900/60 rounded-lg p-1 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-500">Network:</span>
                <div className="flex items-center gap-3">
                  <span className="text-green-600 dark:text-green-400 font-semibold">Base Sepolia Testnet</span>
                  <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded-full text-xs">Chain ID: 84532</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Tabs */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-6 border-b border-gray-200 dark:border-gray-700 relative overflow-hidden"
      >
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex space-x-1 sm:space-x-8 min-w-max pb-2">
            <button
              onClick={() => setActiveTab('hunters')}
              className={`relative py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'hunters'
                  ? 'text-btb-primary dark:text-btb-primary-light'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                My Hunters
              </div>
              {activeTab === 'hunters' && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-btb-primary to-blue-600"
                  initial={false}
                />
              )}
            </button>
            
            <button
              onClick={() => {
                setActiveTab('deposit');
                setShowDeposit(true);
              }}
              className={`relative py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'deposit'
                  ? 'text-btb-primary dark:text-btb-primary-light'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                Deposit
              </div>
              {activeTab === 'deposit' && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-btb-primary to-blue-600"
                  initial={false}
                />
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('redeem')}
              className={`relative py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'redeem'
                  ? 'text-btb-primary dark:text-btb-primary-light'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Redeem
              </div>
              {activeTab === 'redeem' && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-btb-primary to-blue-600"
                  initial={false}
                />
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('protection')}
              className={`relative py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'protection'
                  ? 'text-btb-primary dark:text-btb-primary-light'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Protection
              </div>
              {activeTab === 'protection' && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-btb-primary to-blue-600"
                  initial={false}
                />
              )}
            </button>
          </div>
        </div>
      </motion.div>
      
      {/* Tab Content */}
      <div>
        {/* Hunters Tab */}
        {activeTab === 'hunters' && (
          <>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <div className="relative mb-6">
                    <div className="relative">
                      {/* Outer rings */}
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute rounded-full border-2 border-btb-primary/20"
                          style={{
                            width: `${100 + i * 20}px`,
                            height: `${100 + i * 20}px`,
                            top: `${-i * 10}px`,
                            left: `${-i * 10}px`,
                          }}
                          animate={{
                            scale: [1, 1.1, 1],
                            opacity: [0.2, 0.5, 0.2],
                          }}
                          transition={{
                            duration: 3 + i * 0.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.2
                          }}
                        />
                      ))}
                    
                      {/* Spinning loader */}
                      <motion.div 
                        className="relative h-24 w-24 border-4 border-btb-primary/20 rounded-full overflow-hidden"
                      >
                        {/* Inner content */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <motion.div
                            className="text-4xl"
                            animate={{ rotate: [0, 10, 0, -10, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                          >
                            🐻
                          </motion.div>
                        </div>
                      </motion.div>
                      
                      {/* Spinning borders */}
                      <motion.div 
                        className="absolute top-0 left-0 h-24 w-24 border-4 border-transparent border-t-btb-primary rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      />
                      
                      <motion.div 
                        className="absolute top-0 left-0 h-24 w-24 border-4 border-transparent border-r-blue-500 rounded-full"
                        animate={{ rotate: -180 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      />
                      
                      {/* Hunting paw effects */}
                      {[...Array(6)].map((_, i) => {
                        const angle = (i * 60) * (Math.PI / 180);
                        const x = Math.cos(angle) * 60;
                        const y = Math.sin(angle) * 60;
                        
                        return (
                          <motion.div
                            key={i}
                            className="absolute h-4 w-4 rounded-full bg-btb-primary/50"
                            style={{
                              left: '50%',
                              top: '50%',
                              marginLeft: '-8px',
                              marginTop: '-8px',
                            }}
                            animate={{
                              x: [0, x * 0.5, x],
                              y: [0, y * 0.5, y],
                              opacity: [0, 1, 0],
                              scale: [0.5, 1.5, 0.5]
                            }}
                            transition={{
                              duration: 3,
                              repeat: Infinity,
                              delay: i * 0.5,
                              ease: "easeInOut"
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  
                  <motion.p 
                    className="text-lg font-semibold text-btb-primary dark:text-btb-primary-light mb-2"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    Loading Hunters
                  </motion.p>
                  
                  <div className="flex space-x-2 mb-3">
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="h-2 w-2 rounded-full bg-btb-primary/70"
                        animate={{
                          scale: [0.5, 1.5, 0.5],
                          opacity: [0.3, 1, 0.3]
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.3,
                          ease: "easeInOut"
                        }}
                      />
                    ))}
                  </div>
                  
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Connecting to blockchain and fetching your data...
                  </p>
                </div>
              </div>
            ) : hunters.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🐻</div>
                <h3 className="text-xl font-bold mb-2">No Hunters Yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                  Start by depositing a BEAR NFT to get your first Hunter and 1,000,000 MiMo tokens!
                </p>
                <button
                  onClick={() => {
                    setShowDeposit(true);
                    setActiveTab('deposit');
                  }}
                  className="bg-btb-primary hover:bg-blue-600 text-white py-2 px-6 rounded-lg transition-colors"
                >
                  Deposit BEAR NFT
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {hunters.map((hunter) => (
                  <HunterCard
                    key={hunter.id}
                    hunter={hunter}
                    onFeed={handleFeed}
                    onHunt={handleHunt}
                  />
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Deposit Tab */}
        {activeTab === 'deposit' && <DepositBear />}
        
        {/* Redeem Tab */}
        {activeTab === 'redeem' && <RedeemBear />}
        
        {/* Protection Tab */}
        {activeTab === 'protection' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-blue-800/30"
          >
            <div className="flex items-center mb-6">
              <div className="bg-gradient-to-r from-yellow-500 to-amber-600 p-3 rounded-lg shadow-lg text-white mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 to-amber-600 dark:from-yellow-400 dark:to-amber-500">
                  Protection System
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Secure your MiMo tokens from being hunted by other players
                </p>
              </div>
            </div>
            
            <div className="mb-8 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800/30 shadow-md">
              <div className="flex items-start">
                <div className="bg-yellow-400 dark:bg-yellow-600 rounded-lg p-2 shadow-md mr-4 flex-shrink-0 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2 text-yellow-800 dark:text-yellow-300">Why Protection Matters</h3>
                  <p className="text-yellow-700 dark:text-yellow-200 leading-relaxed">
                    In the MiMo game, <span className="font-bold">unprotected wallets</span> are at risk of having their MiMo tokens hunted by other players. 
                    This means that without proper protection mechanisms in place, your hard-earned MiMo tokens could be taken by hunters!
                  </p>
                  <div className="bg-white/30 dark:bg-black/20 mt-3 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800/50">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        Protection is critical for maintaining your MiMo token balance over time.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-8">
              <div className="flex items-center mb-5">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-2 rounded-lg shadow-md text-white mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M4.293 15.707a1 1 0 010-1.414L8.586 10 4.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-emerald-700 dark:from-green-400 dark:to-emerald-500">
                  How to Protect Your MiMo
                </h3>
              </div>
              
              <div className="bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900/80 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700 mb-5">
                <p className="mb-5 text-gray-700 dark:text-gray-300 leading-relaxed">
                  The best way to protect your MiMo tokens is by providing liquidity on <span className="font-bold text-btb-primary dark:text-btb-primary-light">Aerodrome Exchange</span>. 
                  This helps grow the ecosystem while securing your assets from hunters.
                </p>
                
                <h4 className="font-bold text-lg mb-4 text-gray-800 dark:text-gray-200 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-btb-primary mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                  </svg>
                  Supported Liquidity Pairs
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <motion.div 
                    whileHover={{ 
                      y: -5,
                      boxShadow: "0 15px 30px -10px rgba(59, 130, 246, 0.3)"
                    }}
                    className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 shadow-md"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-btb-primary flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800">
                          Mi
                        </div>
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800">
                          $
                        </div>
                      </div>
                      <span className="flex items-center bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full text-xs font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Supported
                      </span>
                    </div>
                    <div className="text-center">
                      <h4 className="font-bold text-btb-primary dark:text-btb-primary-light">MiMo/USDC</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Stable pair</p>
                    </div>
                  </motion.div>
                  
                  <motion.div 
                    whileHover={{ 
                      y: -5,
                      boxShadow: "0 15px 30px -10px rgba(59, 130, 246, 0.3)"
                    }}
                    className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 shadow-md"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-btb-primary flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800">
                          Mi
                        </div>
                        <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800">
                          ₿
                        </div>
                      </div>
                      <span className="flex items-center bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full text-xs font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Supported
                      </span>
                    </div>
                    <div className="text-center">
                      <h4 className="font-bold text-btb-primary dark:text-btb-primary-light">MiMo/cbBTC</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">BTC pair</p>
                    </div>
                  </motion.div>
                  
                  <motion.div 
                    whileHover={{ 
                      y: -5,
                      boxShadow: "0 15px 30px -10px rgba(59, 130, 246, 0.3)"
                    }}
                    className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 shadow-md"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-btb-primary flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800">
                          Mi
                        </div>
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800">
                          Ξ
                        </div>
                      </div>
                      <span className="flex items-center bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full text-xs font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Supported
                      </span>
                    </div>
                    <div className="text-center">
                      <h4 className="font-bold text-btb-primary dark:text-btb-primary-light">MiMo/WETH</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ETH pair</p>
                    </div>
                  </motion.div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 border border-blue-100 dark:border-blue-800/30 shadow-md">
                <div className="flex items-start">
                  <div className="bg-blue-500 rounded-lg p-2 text-white mr-4 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">How Protection Works</h4>
                    <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                      <li className="flex items-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        When you provide liquidity to approved pools, your wallet address is automatically added to the game contract's Protected Addresses list.
                      </li>
                      <li className="flex items-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Hunters cannot extract MiMo tokens from protected wallets - the contract will check if the target is protected before allowing hunts.
                      </li>
                      <li className="flex items-start">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        You can be both a Hunter and a protected liquidity provider - this gives you the best of both worlds!
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 bg-white dark:bg-gray-900 rounded-xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <div className={`h-6 w-6 rounded-full ${isAddressProtected ? 'bg-green-500' : 'bg-red-500'} mr-3 flex items-center justify-center`}>
                    {isAddressProtected ? (
                      <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-xl font-bold">
                    {isAddressProtected ? (
                      <span className="text-green-600 dark:text-green-400">Your address is protected</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">Your address is not protected</span>
                    )}
                  </h3>
                </div>
              </div>
              
              <div className="p-6">
                {isAddressProtected ? (
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800/30 flex items-start">
                    <div className="bg-green-100 dark:bg-green-800 rounded-full p-2 text-green-600 dark:text-green-200 mr-3 flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-green-700 dark:text-green-300 font-medium">
                        Your wallet is protected! You've provided liquidity to a supported pair.
                      </p>
                      <p className="text-green-600 dark:text-green-400 text-sm mt-1">
                        Your MiMo tokens cannot be hunted by other players.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800/30 flex items-start mb-6">
                      <div className="bg-red-100 dark:bg-red-800 rounded-full p-2 text-red-600 dark:text-red-200 mr-3 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-red-700 dark:text-red-300 font-medium">
                          Your wallet is not protected! Your MiMo tokens can be hunted by other players.
                        </p>
                        <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                          Add liquidity on Aerodrome to protect your assets.
                        </p>
                      </div>
                    </div>
                    
                    <motion.a
                      href="https://aerodrome.finance" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center bg-gradient-to-r from-btb-primary to-blue-600 text-white py-4 rounded-xl font-bold shadow-lg transition-all duration-200 flex items-center justify-center"
                      whileHover={{ 
                        scale: 1.02, 
                        boxShadow: "0 15px 30px -5px rgba(59, 130, 246, 0.5)" 
                      }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                      </svg>
                      Add Liquidity on Aerodrome
                    </motion.a>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}