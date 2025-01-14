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
import {
  FaTwitter,
  FaDiscord,
  FaTelegram,
  FaGithub,
  FaEthereum,
} from 'react-icons/fa';
import { SiOptimism } from 'react-icons/si';

export const Icons = {
  ChartBar: ChartBarIcon,
  ShieldCheck: ShieldCheckIcon,
  CurrencyDollar: CurrencyDollarIcon,
  ArrowTrend: ArrowTrendingUpIcon,
  UserGroup: UserGroupIcon,
  Lock: LockClosedIcon,
  ChevronRight: ChevronRightIcon,
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
