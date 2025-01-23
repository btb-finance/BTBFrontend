'use client';

import {
  ChartBarIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  LockClosedIcon,
  ChevronRightIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { FaTwitter, FaDiscord, FaTelegram, FaGithub, FaEthereum } from 'react-icons/fa';
import { SiOptimism } from 'react-icons/si';

export const Icons = {
  ChartBar: ChartBarIcon,
  ShieldCheck: ShieldCheckIcon,
  CurrencyDollar: CurrencyDollarIcon,
  ArrowTrend: ArrowTrendingUpIcon,
  UserGroup: UserGroupIcon,
  Lock: LockClosedIcon,
  ChevronRight: ChevronRightIcon,
  Activity: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Repeat: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  ),
  PieChart: (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21.21 15.89A10 10 0 118 2.83" />
      <path d="M22 12A10 10 0 0012 2v10z" />
    </svg>
  ),
  ExternalLink: ArrowTopRightOnSquareIcon,
  Twitter: FaTwitter,
  Discord: FaDiscord,
  Telegram: FaTelegram,
  Github: FaGithub,
  Ethereum: FaEthereum,
  Optimism: SiOptimism,
  Check: CheckCircleIcon,
} as const;

export type IconName = keyof typeof Icons;
