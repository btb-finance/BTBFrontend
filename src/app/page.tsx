import Link from 'next/link';
import { 
  CurrencyDollarIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import Testimonials from './components/home/Testimonials';
import Stats from './components/home/Stats';

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

export default function Home() {
  return (
    <div className="relative isolate">
      {/* Hero section */}
      <div className="relative pt-14">
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#FF0420] to-[#FF0420] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
        </div>
        
        <div className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
                Revolutionizing DeFi with BTB Finance
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                Join the future of decentralized finance with our comprehensive ecosystem of digital assets and yield farming solutions.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link
                  href="/tokens"
                  className="rounded-md bg-[#FF0420] px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF0420]"
                >
                  Explore Tokens
                </Link>
                <Link
                  href="/yield"
                  className="rounded-md border-2 border-[#FF0420] px-3.5 py-2.5 text-sm font-semibold text-[#FF0420] shadow-sm hover:bg-[#FF0420] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF0420]"
                >
                  Start Yield Farming
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature section */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-24">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <div className="grid grid-cols-1 gap-8 text-center lg:grid-cols-4">
            {features.map((feature) => (
              <Link
                key={feature.name}
                href={feature.href}
                className="group relative block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <div className="flex flex-col items-center">
                  <feature.icon className="h-12 w-12 text-[#FF0420] mb-4" />
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
      <div className="bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="relative isolate overflow-hidden bg-[#FF0420] px-6 py-24 text-center shadow-2xl sm:rounded-3xl sm:px-16">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Join the BTB Finance Revolution
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-red-100">
              Be part of the future of decentralized finance with our innovative blockchain solutions and yield farming opportunities.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/tokens"
                className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-[#FF0420] shadow-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get Started
              </Link>
              <Link
                href="/community"
                className="text-sm font-semibold leading-6 text-white"
              >
                Join Community <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="absolute -top-24 right-0 -z-10 transform-gpu blur-3xl" aria-hidden="true">
              <div className="aspect-[1404/767] w-[87.75rem] bg-gradient-to-r from-[#FF0420] to-[#FF0420] opacity-25" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
