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

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { address, isConnected, isConnecting, connectWallet, disconnectWallet } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [expandedMobileItems, setExpandedMobileItems] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState<string>('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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
      name: 'Tools',
      icon: CalculatorIcon,
      children: [
        { name: 'Calculator', href: '/calculator' },
        { name: 'Dashboard', href: '/dashboard' },
      ]
    },
    {
      name: 'Invest',
      icon: ChartBarIcon,
      children: [
        { name: 'Pools', href: '/pools' },
        { name: 'Staking', href: '/staking' },
        { name: 'BTB Exchange', href: '/btb-exchange' },
        { name: 'Yield Trading', href: '/yield-trading' },
        { name: 'CHICKS', href: '/chicks' },
        { name: 'Megapot Lottery', href: '/contracts/megapot' },
      ]
    },
    {
      name: 'Learn',
      href: '/education',
      icon: AcademicCapIcon
    },
    {
      name: 'Products',
      icon: CubeTransparentIcon,
      children: [
        { name: 'Hooks', href: '/hooks' },
        { name: 'Hooks v2', href: '/hooks-v2' },
      ]
    },
    {
      name: 'Token',
      icon: CurrencyDollarIcon,
      children: [
        { name: 'Token Info', href: '/token' },
        { name: 'Buy Token', href: '/buy-token' },
      ]
    },
    {
      name: 'Community',
      href: '/community',
      icon: UserGroupIcon
    },
    {
      name: 'Wallet',
      icon: WalletIcon,
      children: [
        { name: 'Connect Wallet', href: '#', action: 'connect' },
        { name: 'View Transactions', href: isConnected ? `https://basescan.org/address/${address}` : '#', disabled: !isConnected },
        { name: 'Wallet Balance', href: '/wallet/balance', disabled: !isConnected },
        { name: 'Wallet Details', href: '/wallet/details', disabled: !isConnected }
      ]
    },
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
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto px-4 py-3 md:p-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center"
        >
          <Logo showText={true} size={40} />
        </motion.div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-2">
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
                      className={`flex items-center px-4 py-2 text-sm font-medium rounded-md text-white hover:bg-white/20 transition-all duration-300 ${activeItem === item.name ? 'bg-white/20 shadow-md' : ''}`}
                    >
                      {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                      <span className="font-heading font-semibold text-white hover:text-btb-primary-light transition-all duration-300">
                        {item.name}
                      </span>
                      <ChevronDownIcon className={`ml-1 h-4 w-4 transition-transform duration-200 ${openDropdown === item.name ? 'rotate-180' : ''}`} />
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
                            className="w-full text-left px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 font-medium"
                            onClick={() => {
                              isConnected ? disconnectWallet() : connectWallet();
                              setActiveItem(item.name);
                              setIsMenuOpen(false);
                              setOpenDropdown(null);
                            }}
                          >
                            <span className="font-heading text-btb-primary dark:text-white hover:text-btb-primary-light dark:hover:text-btb-primary-light transition-all duration-300">
                              {isConnected ? 'Disconnect Wallet' : child.name}
                            </span>
                          </button>
                        ) : (
                          <Link 
                            href={child.href} 
                            className="w-full cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 font-medium"
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
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md text-white hover:bg-white/20 transition-all duration-300 ${activeItem === item.name ? 'bg-white/20 shadow-md' : ''}`}
                  onClick={() => setActiveItem(item.name)}
                >
                  {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                  <span className="font-heading font-semibold text-white hover:text-btb-primary-light transition-all duration-300">
                    {item.name}
                  </span>
                </Link>
              )}
            </motion.div>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          {/* Mobile menu button */}
          <motion.button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            type="button"
            className="inline-flex items-center justify-center p-3 w-12 h-12 text-sm text-white rounded-lg md:hidden hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300 shadow-sm mobile-touch-target"
            aria-controls="mobile-menu"
            aria-expanded={isMenuOpen}
            whileTap={{ scale: 0.95 }}
          >
            {isMenuOpen ? (
              <XMarkIcon className="w-7 h-7" />
            ) : (
              <Bars3Icon className="w-7 h-7" />
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
              className="fixed left-0 right-0 top-[64px] p-4 bg-white dark:bg-gray-800 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700 md:hidden shadow-lg overflow-y-auto max-h-[calc(100vh-64px)]"
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
                  <button
                    onClick={isConnected ? disconnectWallet : connectWallet}
                    className={`w-full flex items-center justify-center px-4 py-3 text-sm font-medium rounded-md ${isConnected ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-btb-primary hover:bg-btb-primary-dark text-white'} transition-all duration-300 shadow-sm`}
                  >
                    <WalletIcon className="mr-2 h-5 w-5" />
                    {isConnecting ? 'Connecting...' : isConnected ? 
                      `${address?.substring(0, 6)}...${address?.substring(address.length - 4)}` : 
                      'Connect Wallet'}
                  </button>
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
                          className="flex items-center justify-between px-4 py-3 text-btb-primary-dark font-medium border-b border-gray-200 dark:border-gray-700 cursor-pointer"
                          onClick={() => toggleMobileSubmenu(item.name)}
                        >
                          <div className="flex items-center">
                            {item.icon && <item.icon className="mr-2 h-5 w-5" />}
                            <span className="font-heading font-semibold text-btb-primary-dark hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-300">
                              {item.name}
                            </span>
                          </div>
                          <ChevronRightIcon 
                            className={`h-5 w-5 transition-transform duration-300 ${expandedMobileItems.includes(item.name) ? 'rotate-90' : ''}`} 
                          />
                        </div>
                        
                        <AnimatePresence>
                          {expandedMobileItems.includes(item.name) && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="pl-4"
                            >
                              <ul className="space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                                {item.children.map((child) => (
                                  <li key={child.name}>
                                    {child.action === 'connect' ? (
                                      <button 
                                        className="block w-full text-left py-3 px-4 text-base text-btb-primary-dark hover:text-gray-700 dark:hover:text-gray-300 rounded-md transition-all duration-200 font-medium"
                                        onClick={() => {
                                          isConnected ? disconnectWallet() : connectWallet();
                                          setIsMenuOpen(false);
                                        }}
                                      >
                                        <span className="font-heading text-btb-primary-dark hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-300">
                                          {isConnected ? 'Disconnect Wallet' : child.name}
                                        </span>
                                      </button>
                                    ) : (
                                      <Link 
                                        href={child.href} 
                                        className={`block py-3 px-4 text-base text-btb-primary-dark hover:text-gray-700 dark:hover:text-gray-300 rounded-md transition-all duration-200 font-medium ${child.disabled ? 'opacity-50 pointer-events-none' : ''}`}
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
                        className="flex items-center px-4 py-3 text-base text-btb-primary-dark font-medium hover:text-gray-700 dark:hover:text-gray-300 rounded-md transition-all duration-200 shadow-sm"
                        onClick={() => {
                          setIsMenuOpen(false);
                        }}
                      >
                        {item.icon && <item.icon className="mr-2 h-5 w-5" />}
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
