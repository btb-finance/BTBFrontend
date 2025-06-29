'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { 
  Bars3Icon, 
  XMarkIcon, 
  ChevronDownIcon, 
  HomeIcon, 
  CalculatorIcon, 
  ChartBarIcon, 
  AcademicCapIcon, 
  CubeTransparentIcon, 
  CurrencyDollarIcon, 
  UserGroupIcon, 
  WalletIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import Logo from '../common/Logo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../../context/WalletContext';
import { ConnectKitButton } from 'connectkit';

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { address, isConnected, isConnecting, connectWallet, disconnectWallet, error, clearError } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [expandedMobileItems, setExpandedMobileItems] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState<string>('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  // Define navigation structure
  type NavigationItem = {
    name: string;
    href?: string;
    icon?: React.ElementType;
    children?: Array<{
      name: string;
      href: string;
      action?: string;
      disabled?: boolean;
    }>;
  };

  const navigation: NavigationItem[] = [
    {
      name: 'Home',
      href: '/',
      icon: HomeIcon
    },
    {
      name: 'Live Products',
      icon: CubeTransparentIcon,
      children: [
        { name: 'Larry Ecosystem', href: '/larryecosystem' },
        { name: 'CHICKS', href: '/chicks' },
        { name: 'Megapot Lottery', href: '/megapot' },
      ]
    },
    {
      name: 'Tools',
      icon: CalculatorIcon,
      children: [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'Bulk Sender', href: '/bulksender' },
        { name: 'Token Creator', href: '/token-creator' },
        { name: 'Aero Booster', href: '/aero-booster' }
      ]
    },
    {
      name: 'Token',
      icon: CurrencyDollarIcon,
      children: [
        { name: 'BTB Finance', href: '/btb-finance' },
        { name: 'NFT Swap', href: '/nftswap' }
      ]
    }
  ];

  useEffect(() => {
    setMounted(true);
    // Set initial theme
    if (!theme) {
      setTheme('dark');
    }
  }, [theme, setTheme]);

  // Track active item for hover effects
  useEffect(() => {
    // Only add event listeners if component is mounted
    if (mounted) {
      const handleRouteChange = () => {
        const path = window.location.pathname;
        const active = navigation.find(item => 
          item.href === path || (item.children && item.children.some(child => child.href === path))
        );
        setActiveItem(active?.name || '');
      };
      
      handleRouteChange();
      window.addEventListener('popstate', handleRouteChange);
      return () => window.removeEventListener('popstate', handleRouteChange);
    }
  }, [mounted]);

  // Track error state for auto-dismiss
  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
        clearError();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  if (!mounted) {
    return null;
  }

  // Handle hover events for dropdown menus
  const handleMouseEnter = (itemName: string) => {
    setOpenDropdown(itemName);
    setActiveItem(itemName);
  };

  const handleMouseLeave = () => {
    setOpenDropdown(null);
  };

  const toggleMobileSubmenu = (itemName: string) => {
    setExpandedMobileItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(item => item !== itemName) 
        : [...prev, itemName]
    );
  };

  return (
    <nav className="fixed w-full z-20 top-0 left-0 bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light backdrop-blur-lg border-b border-white/20 shadow-lg">
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto px-3 py-2 md:px-4 md:py-2">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center"
        >
          <Logo showText={true} size={32} />
        </motion.div>

        {/* Wallet Error Notification */}
        <AnimatePresence>
          {error && showError && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="fixed top-14 right-4 z-50 bg-red-600 text-white px-3 py-1 rounded-md shadow-lg text-xs"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-1">
          {navigation.map((item) => (
            <motion.div 
              key={item.name} 
              className="relative group"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: navigation.indexOf(item) * 0.1 }}
              onMouseEnter={() => handleMouseEnter(item.name)}
              onMouseLeave={handleMouseLeave}
            >
              {item.children ? (
                <DropdownMenu open={openDropdown === item.name} onOpenChange={(open) => {
                  if (!open) setOpenDropdown(null);
                }}>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white hover:bg-white/20 transition-all duration-300 ${activeItem === item.name ? 'bg-white/20 shadow-md' : ''}`}
                    >
                      {item.icon && <item.icon className="mr-1.5 h-3.5 w-3.5" />}
                      <span className="font-heading font-semibold text-white hover:text-btb-primary-light transition-all duration-300">
                        {item.name}
                      </span>
                      <ChevronDownIcon className={`ml-1 h-3.5 w-3.5 transition-transform duration-200 ${openDropdown === item.name ? 'rotate-180' : ''}`} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="center" 
                    className="w-48 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white rounded-lg shadow-lg animate-in fade-in-50 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
                  >
                    {item.children.map((child) => (
                      <DropdownMenuItem key={child.name} asChild>
                        {child.action === 'connect' ? (
                          <button 
                            className="w-full text-left px-3 py-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 font-medium"
                            onClick={() => {
                              try {
                                isConnected ? disconnectWallet() : connectWallet();
                                setActiveItem(item.name);
                                setIsMenuOpen(false);
                                setOpenDropdown(null);
                              } catch (err) {
                                console.error("Connection error:", err);
                              }
                            }}
                          >
                            <span className="font-heading text-btb-primary dark:text-white hover:text-btb-primary-light dark:hover:text-btb-primary-light transition-all duration-300">
                              {isConnected ? 'Disconnect Wallet' : isConnecting ? 'Connecting...' : child.name}
                            </span>
                          </button>
                        ) : child.name.includes('🔜') ? (
                          <Link 
                            href={child.href} 
                            className="w-full px-3 py-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 font-medium flex items-center justify-between"
                            onClick={() => {
                              setActiveItem(item.name);
                              setIsMenuOpen(false);
                              setOpenDropdown(null);
                            }}
                          >
                            <span className="font-heading text-btb-primary dark:text-white hover:text-btb-primary-light dark:hover:text-btb-primary-light transition-all duration-300">
                              {child.name}
                            </span>
                          </Link>
                        ) : (
                          <Link 
                            href={child.href} 
                            className="w-full px-3 py-1.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 font-medium"
                            onClick={() => {
                              setActiveItem(item.name);
                              setIsMenuOpen(false);
                              setOpenDropdown(null);
                            }}
                          >
                            <span className="font-heading text-btb-primary dark:text-white hover:text-btb-primary-light dark:hover:text-btb-primary-light transition-all duration-300">
                              {child.name}
                            </span>
                          </Link>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link 
                  href={item.href || '#'} 
                  className={`flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white hover:bg-white/20 transition-all duration-300 ${activeItem === item.name ? 'bg-white/20 shadow-md' : ''}`}
                  onClick={() => setActiveItem(item.name)}
                >
                  {item.icon && <item.icon className="mr-1.5 h-3.5 w-3.5" />}
                  <span className="font-heading font-semibold text-white hover:text-btb-primary-light transition-all duration-300">
                    {item.name}
                  </span>
                </Link>
              )}
            </motion.div>
          ))}
        </div>

        <div className="flex items-center space-x-1">
          {/* Desktop Connect Wallet Button - Using ConnectKit */}
          <div className="hidden md:block">
            <ConnectKitButton.Custom>
              {({ isConnected, isConnecting, show, address }) => (
                <motion.button
                  onClick={show}
                  type="button"
                  className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md bg-white text-btb-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300 shadow-sm mr-2"
                  whileTap={{ scale: 0.95 }}
                >
                  <WalletIcon className="mr-1.5 h-3.5 w-3.5" />
                  <span className="font-semibold">
                    {isConnecting ? 'Connecting...' : isConnected ? 
                      `${address?.substring(0, 4)}...${address?.substring(address.length - 4)}` : 
                      'Connect Wallet'}
                  </span>
                </motion.button>
              )}
            </ConnectKitButton.Custom>
          </div>
          
          {/* View Transactions Button - Only when connected */}
          {isConnected && (
            <motion.a
              href={`https://basescan.org/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center justify-center px-2 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 focus:outline-none transition-all duration-300 shadow-sm mr-2"
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ChartBarIcon className="mr-1 h-3.5 w-3.5" />
              <span className="font-semibold">Transactions</span>
            </motion.a>
          )}

          {/* Mobile Wallet Connect Button - Using ConnectKit */}
          <div className="md:hidden">
            <ConnectKitButton.Custom>
              {({ isConnected, isConnecting, show, address }) => (
                <motion.button
                  onClick={show}
                  type="button"
                  className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-md bg-white text-btb-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300 shadow-sm"
                  whileTap={{ scale: 0.95 }}
                >
                  <WalletIcon className="mr-1 h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">
                    {isConnecting ? 'Connecting...' : isConnected ? 
                      `${address?.substring(0, 3)}...${address?.substring(address.length - 2)}` : 
                      'Connect'}
                  </span>
                </motion.button>
              )}
            </ConnectKitButton.Custom>
          </div>
          
          {/* Mobile menu button */}
          <motion.button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            type="button"
            className="inline-flex items-center justify-center p-2 w-9 h-9 text-sm text-white rounded-lg md:hidden hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300 shadow-sm mobile-touch-target"
            aria-controls="mobile-menu"
            aria-expanded={isMenuOpen}
            whileTap={{ scale: 0.95 }}
          >
            {isMenuOpen ? (
              <XMarkIcon className="w-5 h-5" />
            ) : (
              <Bars3Icon className="w-5 h-5" />
            )}
          </motion.button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed left-0 right-0 top-[52px] p-3 bg-white dark:bg-gray-800 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 md:hidden shadow-lg overflow-y-auto max-h-[calc(100vh-52px)]"
              id="mobile-menu"
            >
              <ul className="flex flex-col space-y-3">
                {/* Add wallet button to mobile menu */}
                <motion.li
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="py-2 border-b border-gray-200 dark:border-gray-700 mb-2"
                >
                  <ConnectKitButton.Custom>
                    {({ isConnected, isConnecting, show, address }) => (
                      <button
                        onClick={show}
                        className={`w-full flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md ${isConnected ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-btb-primary hover:bg-btb-primary-dark text-white'} transition-all duration-300 shadow-sm`}
                      >
                        <WalletIcon className="mr-2 h-4 w-4" />
                        {isConnecting ? 'Connecting...' : isConnected ? 
                          `Connected: ${address?.substring(0, 4)}...${address?.substring(address.length - 4)}` : 
                          'Connect Wallet'}
                      </button>
                    )}
                  </ConnectKitButton.Custom>
                  
                  {isConnected && (
                    <a
                      href={`https://basescan.org/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 w-full flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all duration-300 shadow-sm"
                    >
                      <ChartBarIcon className="mr-2 h-4 w-4" />
                      View Transactions
                    </a>
                  )}
                </motion.li>
                
                {navigation.map((item, index) => (
                  <motion.li 
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 + 0.1 }}
                    className="rounded-lg overflow-hidden"
                  >
                    {item.children ? (
                      <div className="space-y-1">
                        <div 
                          className="flex items-center justify-between px-3 py-2 text-btb-primary-dark font-medium border-b border-gray-200 dark:border-gray-700 cursor-pointer"
                          onClick={() => toggleMobileSubmenu(item.name)}
                        >
                          <div className="flex items-center">
                            {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                            <span className="font-heading font-semibold text-btb-primary-dark hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-300">
                              {item.name}
                            </span>
                          </div>
                          <ChevronRightIcon 
                            className={`h-4 w-4 transition-transform duration-300 ${expandedMobileItems.includes(item.name) ? 'rotate-90' : ''}`} 
                          />
                        </div>
                        
                        <AnimatePresence>
                          {expandedMobileItems.includes(item.name) && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="pl-3"
                            >
                              <ul className="space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                                {item.children.map((child) => (
                                  <li key={child.name}>
                                    {child.name.includes('🔜') ? (
                                      <Link 
                                        href={child.href} 
                                        className="block py-2 px-3 text-sm text-btb-primary-dark hover:text-gray-700 dark:hover:text-gray-300 rounded-md transition-all duration-200 font-medium"
                                        onClick={() => setIsMenuOpen(false)}
                                      >
                                        <span className="font-heading text-btb-primary-dark hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-300">
                                          {child.name}
                                        </span>
                                      </Link>
                                    ) : (
                                      <Link 
                                        href={child.href} 
                                        className="block py-2 px-3 text-sm text-btb-primary-dark hover:text-gray-700 dark:hover:text-gray-300 rounded-md transition-all duration-200 font-medium"
                                        onClick={() => setIsMenuOpen(false)}
                                      >
                                        <span className="font-heading text-btb-primary-dark hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-300">
                                          {child.name}
                                        </span>
                                      </Link>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <Link 
                        href={item.href || '#'} 
                        className="flex items-center px-3 py-2 text-sm text-btb-primary-dark font-medium hover:text-gray-700 dark:hover:text-gray-300 rounded-md transition-all duration-200 shadow-sm"
                        onClick={() => {
                          setIsMenuOpen(false);
                        }}
                      >
                        {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                        <span className="font-heading font-semibold text-btb-primary-dark hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-300">
                          {item.name}
                        </span>
                      </Link>
                    )}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
