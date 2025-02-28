'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { SunIcon, MoonIcon, Bars3Icon, XMarkIcon, ChevronDownIcon, HomeIcon, CalculatorIcon, ChartBarIcon, AcademicCapIcon, CubeTransparentIcon, CurrencyDollarIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import Logo from '../common/Logo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';

// Define navigation structure
const navigation = [
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
      { name: 'BTB Exchange', href: '/btb-exchange' },
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
];

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeItem, setActiveItem] = useState('');

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

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };


  return (
    <nav className="fixed w-full z-20 top-0 left-0 bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light backdrop-blur-lg border-b border-white/20 shadow-lg">
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center"
        >
          <Logo showText={true} size={40} />
          <div className="ml-2 hidden sm:block">
            <span className="text-xs font-semibold text-white/90 bg-btb-primary-dark px-2 py-0.5 rounded-full">on Optimism</span>
          </div>
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
            >
              {item.children ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className={`flex items-center px-4 py-2 text-sm font-medium rounded-md text-white hover:bg-white/20 transition-all duration-300 ${activeItem === item.name ? 'bg-white/20 shadow-md' : ''}`}
                      onMouseEnter={() => setActiveItem(item.name)}
                    >
                      {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                      {item.name}
                      <ChevronDownIcon className="ml-1 h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-48 bg-white dark:bg-gray-800 backdrop-blur-lg border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white rounded-lg shadow-lg">
                    {item.children.map((child) => (
                      <DropdownMenuItem key={child.name} asChild>
                        <Link 
                          href={child.href} 
                          className="w-full cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                          onClick={() => {
                            setActiveItem(item.name);
                            setIsMenuOpen(false);
                          }}
                        >
                          {child.name}
                        </Link>
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
                  {item.name}
                </Link>
              )}
            </motion.div>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <motion.button
            onClick={toggleTheme}
            className="p-2 text-white rounded-lg hover:bg-white/20 transition-all duration-300 shadow-sm"
            aria-label="Toggle theme"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            {theme === 'dark' ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </motion.button>
          
          {/* Mobile menu button */}
          <motion.button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            type="button"
            className="inline-flex items-center p-2 text-sm text-white rounded-lg md:hidden hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300 shadow-sm"
            aria-controls="mobile-menu"
            aria-expanded={isMenuOpen}
            whileTap={{ scale: 0.95 }}
          >
            {isMenuOpen ? (
              <XMarkIcon className="w-6 h-6" />
            ) : (
              <Bars3Icon className="w-6 h-6" />
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
              className="fixed left-0 right-0 top-[72px] p-4 bg-gradient-to-b from-btb-primary to-btb-primary-dark backdrop-blur-lg border-t border-white/20 md:hidden shadow-lg overflow-hidden"
              id="mobile-menu"
            >
              <ul className="flex flex-col space-y-2">
                {navigation.map((item, index) => (
                  <motion.li 
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {item.children ? (
                      <div className="space-y-2">
                        <div className="flex items-center px-3 py-2 text-white font-medium border-b border-white/30">
                          {item.icon && <item.icon className="mr-2 h-5 w-5" />}
                          {item.name}
                        </div>
                        <ul className="pl-5 space-y-2">
                          {item.children.map((child, childIndex) => (
                            <motion.li 
                              key={child.name}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: childIndex * 0.05 + 0.2 }}
                            >
                              <Link 
                                href={child.href} 
                                className="block py-2 px-3 text-sm text-white hover:bg-white/20 rounded-md transition-all duration-200"
                                onClick={() => setIsMenuOpen(false)}
                              >
                                {child.name}
                              </Link>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <Link 
                        href={item.href || '#'} 
                        className="flex items-center px-3 py-2 text-white font-medium hover:bg-white/20 rounded-md transition-all duration-200 shadow-sm"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {item.icon && <item.icon className="mr-2 h-5 w-5" />}
                        {item.name}
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
