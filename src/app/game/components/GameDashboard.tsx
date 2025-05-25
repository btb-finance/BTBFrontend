'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame } from './GameContext';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import HunterCard from './HunterCard';
import DepositBear from './DepositBear';
import RedeemBear from './RedeemBear';
import GameOverview from './GameOverview';
import HuntMimo from './HuntMimo';
import MultipleHuntModal from './MultipleHuntModal';
import MultipleFeedModal from './MultipleFeedModal';
import MultipleTargetHuntModal from './MultipleTargetHuntModal';

export default function GameDashboard() {
  const { 
    loading, 
    hunters, 
    mimoBalance, 
    isAddressProtected, 
    feedHunter, 
    refreshData, 
    error,
    selectedHunters,
    clearSelectedHunters,
    toggleHunterSelection,
    selectAllHunters
  } = useGame();
  const { address, connectWallet } = useWalletConnection();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  
  // Create a dedicated state for each hunter ID's modal
  const [huntModalHunterId, setHuntModalHunterId] = useState<number | null>(null);
  const [showMultipleHuntModal, setShowMultipleHuntModal] = useState(false);
  const [showMultipleFeedModal, setShowMultipleFeedModal] = useState(false);
  const [multipleTargetHunterId, setMultipleTargetHunterId] = useState<number | null>(null);
  

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

  const handleHunt = (hunterId: number) => {
    // Simply set the hunter ID to show the modal for
    setHuntModalHunterId(hunterId);
  };
  
  const handleHuntSuccess = () => {
    // Close the modal
    setHuntModalHunterId(null);
    refreshData();
    setNotification({
      type: 'success',
      message: 'Successfully hunted MiMo tokens!',
    });
  };

  const handleMultipleHuntSuccess = () => {
    setShowMultipleHuntModal(false);
    refreshData();
    setNotification({
      type: 'success',
      message: 'Successfully performed bulk hunt!',
    });
  };

  const handleMultipleFeedSuccess = () => {
    setShowMultipleFeedModal(false);
    refreshData();
    setNotification({
      type: 'success',
      message: 'Successfully fed multiple hunters!',
    });
  };

  const handleMultipleTargetHuntSuccess = () => {
    setMultipleTargetHunterId(null);
    refreshData();
    setNotification({
      type: 'success',
      message: 'Successfully hunted multiple targets!',
    });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Redesigned Game Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="relative bg-gradient-to-r from-btb-primary via-blue-600 to-indigo-600 rounded-2xl shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-black opacity-20"></div>
          
          <div className="relative p-6 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center">
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl mr-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13 7H7v6h6V7z" />
                    <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-bold">MiMo Game</h1>
                  <p className="text-blue-100 text-sm">Hunt, earn, and grow your ecosystem</p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4 items-center">
                {/* Wallet Status Indicator */}
                <div className="flex items-center space-x-3">
                  {address ? (
                    <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium truncate max-w-[120px]">
                        {address.slice(0, 6)}...{address.slice(-4)}
                      </span>
                    </div>
                  ) : (
                    <motion.button
                      onClick={connectWallet}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="bg-white/20 backdrop-blur-sm rounded-full px-6 py-2 font-medium hover:bg-white/30 transition-colors"
                    >
                      Connect Wallet
                    </motion.button>
                  )}
                  
                  {address && (
                    <motion.button
                      onClick={refreshData}
                      whileHover={{ rotate: 180 }}
                      whileTap={{ scale: 0.9 }}
                      className="bg-white/20 backdrop-blur-sm rounded-full p-2 hover:bg-white/30 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Stats Bar */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 cursor-default pointer-events-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">MiMo Balance</p>
                    <p className="text-2xl font-bold">
                      {loading ? '...' : parseFloat(mimoBalance).toLocaleString()}
                    </p>
                  </div>
                  <svg className="w-8 h-8 text-blue-200" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 cursor-default pointer-events-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Protection</p>
                    <p className={`text-2xl font-bold ${isAddressProtected ? 'text-green-300' : 'text-red-300'}`}>
                      {isAddressProtected ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <div className={`p-2 rounded-full ${isAddressProtected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    <svg className={`w-6 h-6 ${isAddressProtected ? 'text-green-300' : 'text-red-300'}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 cursor-default pointer-events-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Network</p>
                    <p className="text-xl font-bold">Base Sepolia</p>
                  </div>
                  <div className="p-2 rounded-full bg-blue-500/20">
                    <svg className="w-6 h-6 text-blue-200" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Quick Actions */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-6 flex flex-wrap gap-4 relative z-10"
      >
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            console.log('Deposit button clicked');
            setActiveTab('deposit');
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-gradient-to-r from-btb-primary to-blue-600 text-white py-3 px-6 rounded-xl shadow-lg flex items-center font-medium relative z-20 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          Deposit BEAR NFT
        </motion.button>
        
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            console.log('Redeem button clicked');
            setActiveTab('redeem');
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-6 rounded-xl shadow-lg flex items-center font-medium relative z-20 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Redeem BEAR NFT
        </motion.button>
        
        {address && window.ethereum && (
          <motion.button 
            onClick={(e) => {
              e.stopPropagation();
              console.log('Add MiMo button clicked');
              if (window.ethereum) {
                window.ethereum.request({
                  method: 'wallet_watchAsset',
                  params: {
                    type: 'ERC20',
                    options: {
                      address: '0x4A9a2A9e0ca96ff01e8F5EC5890b57EabAb6A9E4',
                      symbol: 'MiMo',
                      decimals: 18,
                      image: 'https://i.imgur.com/9hNQXRQ.png'
                    }
                  }
                }).catch((err) => console.error('Error adding MiMo to wallet:', err));
              }
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 px-6 rounded-xl shadow-lg flex items-center font-medium relative z-20 cursor-pointer"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add MiMo to Wallet
          </motion.button>
        )}
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
              onClick={() => setActiveTab('overview')}
              className={`relative py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'text-btb-primary dark:text-btb-primary-light'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                Overview
              </div>
              {activeTab === 'overview' && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-btb-primary to-blue-600"
                  initial={false}
                />
              )}
            </button>
            
            <button
              onClick={() => {
                setActiveTab('hunters');
              }}
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
              onClick={() => setActiveTab('deposit')}
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
        {/* Overview Tab */}
        {activeTab === 'overview' && <GameOverview />}
        
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
                    setActiveTab('deposit');
                  }}
                  className="bg-btb-primary hover:bg-blue-600 text-white py-2 px-6 rounded-lg transition-colors"
                >
                  Deposit BEAR NFT
                </button>
              </div>
            ) : (
              <div>
                {/* Multi-selection controls */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedHunters.length} of {hunters.length} hunters selected
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          console.log('Select All clicked');
                          selectAllHunters();
                        }}
                        className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1 rounded transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => {
                          console.log('Clear clicked');
                          clearSelectedHunters();
                        }}
                        className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1 rounded transition-colors"
                        disabled={selectedHunters.length === 0}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  
                  {/* Multi-action buttons - Fixed positioning */}
                  <div className="flex flex-wrap gap-2" style={{ position: 'relative', zIndex: 10 }}>
                    {selectedHunters.length > 0 && (
                      <>
                        <button
                          onClick={() => {
                            console.log('Feed Multiple clicked! Selected hunters:', selectedHunters);
                            setShowMultipleFeedModal(true);
                          }}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center transition-colors"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Feed Multiple ({selectedHunters.length})
                        </button>
                        
                        <button
                          onClick={() => {
                            console.log('Hunt Multiple clicked! Selected hunters:', selectedHunters);
                            setShowMultipleHuntModal(true);
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm flex items-center transition-colors"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Hunt Multiple ({selectedHunters.length})
                        </button>
                      </>
                    )}
                    
                    {hunters.some(hunter => hunter.canHuntNow) && (
                      <button
                        onClick={() => {
                          const readyHunter = hunters.find(h => h.canHuntNow);
                          if (readyHunter) {
                            setHuntModalHunterId(readyHunter.id);
                          }
                        }}
                        className="bg-gradient-to-r from-btb-primary to-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Quick Hunt
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hunters.map((hunter) => (
                    <div key={hunter.id} className="relative">
                      {/* Selection checkbox */}
                      <div className="absolute top-2 left-2 z-10">
                        <input
                          type="checkbox"
                          checked={selectedHunters.includes(hunter.id)}
                          onChange={() => toggleHunterSelection(hunter.id)}
                          className="w-4 h-4 text-btb-primary bg-gray-100 border-gray-300 rounded focus:ring-btb-primary dark:focus:ring-btb-primary dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                      
                      {/* Enhanced HunterCard with multi-target hunt option */}
                      <div className="relative">
                        <HunterCard
                          hunter={hunter}
                          onFeed={handleFeed}
                          onHunt={handleHunt}
                        />
                        
                        {/* Multi-target hunt button for individual hunters */}
                        {hunter.canHuntNow && (
                          <button
                            onClick={() => setMultipleTargetHunterId(hunter.id)}
                            className="absolute bottom-2 right-2 bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-lg text-xs flex items-center transition-colors"
                            title="Hunt Multiple Targets"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Deposit Tab */}
        {activeTab === 'deposit' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <DepositBear onSuccess={() => {
                setNotification({
                  type: 'success',
                  message: 'Successfully deposited BEAR NFT and minted a Hunter!',
                });
                refreshData();
              }}/>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-blue-100 dark:border-blue-800/30 p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">About Depositing</h3>
                <div className="space-y-4 text-gray-600 dark:text-gray-400">
                  <p>
                    When you deposit a BEAR NFT, you'll receive a Hunter NFT with base power that can be used to earn MiMo tokens.
                  </p>
                  <div className="flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p>Each Hunter has a lifespan and requires regular feeding to maintain its power.</p>
                  </div>
                  <div className="flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p>You'll also receive a bonus of MiMo tokens as a reward for depositing.</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-100 dark:border-yellow-800/30">
                    <div className="flex">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span className="text-yellow-800 dark:text-yellow-200">
                        The deposited BEAR NFT will be locked in the contract. You can't withdraw it directly, but you can redeem new BEAR NFTs with MiMo tokens.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Redeem Tab */}
        {activeTab === 'redeem' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RedeemBear onSuccess={() => {
                setNotification({
                  type: 'success',
                  message: 'Successfully redeemed a BEAR NFT!',
                });
                refreshData();
              }} />
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-blue-100 dark:border-blue-800/30 p-6">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">About Redeeming</h3>
                <div className="space-y-4 text-gray-600 dark:text-gray-400">
                  <p>
                    You can spend your MiMo tokens to redeem brand new BEAR NFTs that will be sent directly to your wallet.
                  </p>
                  <div className="flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p>The redemption process mints a new BEAR NFT directly to your wallet.</p>
                  </div>
                  <div className="flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p>You can use the redeemed BEAR NFT to mint a new Hunter, sell it on the market, or hold it.</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800/30">
                    <div className="flex">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span className="text-blue-800 dark:text-blue-200">
                        Redeeming a BEAR NFT costs a fixed amount of MiMo tokens, and a small redemption fee may apply.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
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
      
      {/* Hunt Modal */}
      {huntModalHunterId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setHuntModalHunterId(null)}
          ></div>
          <HuntMimo
            hunter={hunters.find(h => h.id === huntModalHunterId)!}
            onClose={() => setHuntModalHunterId(null)}
            onSuccess={handleHuntSuccess}
          />
        </div>
      )}

      {/* Multiple Hunt Modal */}
      {showMultipleHuntModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setShowMultipleHuntModal(false)}
          ></div>
          <MultipleHuntModal
            onClose={() => setShowMultipleHuntModal(false)}
            onSuccess={handleMultipleHuntSuccess}
          />
        </div>
      )}

      {/* Multiple Feed Modal */}
      {showMultipleFeedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setShowMultipleFeedModal(false)}
          ></div>
          <MultipleFeedModal
            onClose={() => setShowMultipleFeedModal(false)}
            onSuccess={handleMultipleFeedSuccess}
          />
        </div>
      )}

      {/* Multiple Target Hunt Modal */}
      {multipleTargetHunterId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setMultipleTargetHunterId(null)}
          ></div>
          <MultipleTargetHuntModal
            hunter={hunters.find(h => h.id === multipleTargetHunterId)!}
            onClose={() => setMultipleTargetHunterId(null)}
            onSuccess={handleMultipleTargetHuntSuccess}
          />
        </div>
      )}
    </div>
  );
}