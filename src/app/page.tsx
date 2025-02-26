import Link from 'next/link';
import Image from 'next/image';
import { 
  CurrencyDollarIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import Testimonials from './components/home/Testimonials';
import Stats from './components/home/Stats';
import TokenScene from './components/home/TokenScene';

const features = [
  {
    name: 'BTB Token Ecosystem',
    description: 'Explore our comprehensive ecosystem of digital assets including BTB Token, BTBT Tax Token, and BTBN NFTs.',
    icon: CurrencyDollarIcon,
    href: '/tokens'
  },
  {
    name: 'Yield Farming Platform',
    description: 'Access sophisticated yield farming solutions with our advanced IL Calculator and pool management tools.',
    icon: ChartBarIcon,
    href: '/yield'
  },
  {
    name: 'Security & Compliance',
    description: 'Trade with confidence knowing your assets are protected by advanced cryptographic methods and smart contract audits.',
    icon: ShieldCheckIcon,
    href: '/security'
  },
  {
    name: 'Global Community',
    description: 'Join our vibrant community of crypto enthusiasts, developers, and investors worldwide.',
    icon: UserGroupIcon,
    href: '/community'
  }
];

const products = [
  {
    name: 'BTB Token',
    description: 'Our governance token with staking rewards and ecosystem benefits.',
    icon: CurrencyDollarIcon,
    href: '/token'
  },
  {
    name: 'Yield Farming',
    description: 'Generate passive income through our innovative yield farming protocols.',
    icon: ChartBarIcon,
    href: '/calculator'
  },
  {
    name: 'Hooks',
    description: 'Advanced DeFi hooks for seamless trading and investment.',
    icon: ShieldCheckIcon,
    href: '/hooks'
  }
];

export default function Home() {
  return (
    <div className="relative isolate">
      {/* Hero section */}
      <div className="relative pt-14">
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-btb-primary to-btb-primary-light opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>
        
        <div className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
                  Revolutionizing DeFi with <span className="text-gradient">BTB Finance</span>
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                  Join the future of decentralized finance with our comprehensive ecosystem of digital assets and yield farming solutions.
                </p>
                <div className="mt-10 flex flex-wrap gap-4">
                  <Link
                    href="/token"
                    className="btn-primary flex items-center"
                  >
                    Explore BTB Token <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Link>
                  <Link
                    href="/calculator"
                    className="btn-secondary"
                  >
                    Start Yield Farming
                  </Link>
                </div>
              </div>
              <div className="h-[400px] w-full relative">
                <TokenScene />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product showcase section */}
      <div className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Explore the BTB Finance ecosystem
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Powerful tools for decentralized finance
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <Link 
                key={index} 
                href={product.href}
                className="card group relative overflow-hidden"
              >
                <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-btb-primary opacity-10 group-hover:opacity-20 transition-opacity" />
                <div className="flex items-center justify-center h-28 w-28 mb-6 text-btb-primary">
                  <product.icon className="h-16 w-16" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {product.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {product.description}
                </p>
                <div className="flex items-center text-btb-primary font-medium">
                  Learn more <ArrowRightIcon className="ml-1 h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Feature section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Powerful DeFi Tools
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Built for both beginners and advanced traders
          </p>
        </div>
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Link
                key={feature.name}
                href={feature.href}
                className="group relative block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden"
              >
                <div className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-btb-primary opacity-0 group-hover:opacity-10 transition-opacity" />
                <div className="flex flex-col items-center relative z-10">
                  <feature.icon className="h-12 w-12 text-btb-primary mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {feature.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Stats section */}
      <Stats />
      
      {/* Testimonials section */}
      <Testimonials />
      
      {/* CTA section */}
      <div className="bg-btb-gradient py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to join BTB Finance?
            </h2>
            <p className="mt-4 text-lg text-white/80">
              Get started with our ecosystem today and experience the future of DeFi.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/calculator"
                className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-btb-primary shadow-sm hover:bg-opacity-90 transition-all"
              >
                Try Calculator
              </Link>
              <Link
                href="/token"
                className="rounded-md border-2 border-white px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-white/10 transition-all"
              >
                Explore Token
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
