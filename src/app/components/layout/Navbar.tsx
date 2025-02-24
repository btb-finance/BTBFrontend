'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { SunIcon, MoonIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set initial theme
    if (!theme) {
      setTheme('dark');
    }
  }, [theme, setTheme]);

  if (!mounted) {
    return null;
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <nav className="fixed w-full z-20 top-0 left-0 bg-gradient-to-r from-primary via-primary/90 to-primary-light backdrop-blur-lg border-b border-white/10">
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
        <Link href="/" className="flex items-center">
          <span className="self-center text-xl md:text-2xl font-semibold whitespace-nowrap text-white">
            BTBFinance
          </span>
        </Link>

        <div className="flex items-center md:order-2">
          <button
            onClick={toggleTheme}
            className="p-2 text-white/80 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </button>
          
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            type="button"
            className="inline-flex items-center p-2 ml-1 text-sm text-white/80 rounded-lg md:hidden hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-controls="mobile-menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? (
              <XMarkIcon className="w-6 h-6" />
            ) : (
              <Bars3Icon className="w-6 h-6" />
            )}
          </button>
        </div>

        <div
          className={`${
            isMenuOpen ? 'block' : 'hidden'
          } items-center justify-between w-full md:flex md:w-auto md:order-1`}
          id="mobile-menu"
        >
          <ul className="flex flex-col p-4 md:p-0 mt-4 font-medium rounded-lg bg-black/20 md:flex-row md:space-x-8 md:mt-0 md:border-0 md:bg-transparent">
            <li>
              <Link 
                href="/calculator" 
                className="block py-2 pl-3 pr-4 text-white rounded hover:bg-white/10 md:hover:bg-transparent md:hover:text-white md:p-0"
                onClick={() => setIsMenuOpen(false)}
              >
                Calculator
              </Link>
            </li>
            <li>
              <Link 
                href="/dashboard" 
                className="block py-2 pl-3 pr-4 text-white rounded hover:bg-white/10 md:hover:bg-transparent md:hover:text-white md:p-0"
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
            </li>
            <li>
              <Link 
                href="/education" 
                className="block py-2 pl-3 pr-4 text-white rounded hover:bg-white/10 md:hover:bg-transparent md:hover:text-white md:p-0"
                onClick={() => setIsMenuOpen(false)}
              >
                Learn
              </Link>
            </li>
            <li>
              <Link 
                href="/hooks" 
                className="block py-2 pl-3 pr-4 text-white rounded hover:bg-white/10 md:hover:bg-transparent md:hover:text-white md:p-0"
                onClick={() => setIsMenuOpen(false)}
              >
                Hooks
              </Link>
            </li>
            <li>
              <Link 
                href="/token" 
                className="block py-2 pl-3 pr-4 text-white rounded hover:bg-white/10 md:hover:bg-transparent md:hover:text-white md:p-0"
                onClick={() => setIsMenuOpen(false)}
              >
                Token
              </Link>
            </li>

            <li>
              <Link 
                href="/buy-token" 
                className="block py-2 pl-3 pr-4 text-white rounded hover:bg-white/10 md:hover:bg-transparent md:hover:text-white md:p-0"
                onClick={() => setIsMenuOpen(false)}
              >
                BuyToken
              </Link>
            </li>

            <li>
              <Link 
                href="/community" 
                className="block py-2 pl-3 pr-4 text-white rounded hover:bg-white/10 md:hover:bg-transparent md:hover:text-white md:p-0"
                onClick={() => setIsMenuOpen(false)}
              >
                Community
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
