'use client';

import { Header } from '@/components/layout/Header';
import { FaqItem } from '@/components/about/FaqItem';
import { Icons } from '@/components/ui/Icons';

export default function AboutPage() {
  const faqs = [
    {
      question: "What is BTB Finance?",
      answer: "BTB Finance is a DeFi protocol designed to protect liquidity providers (LPs) from impermanent loss on Uniswap V3. We achieve this through our innovative Liquidity Refund System, which uses smart fee distribution and community governance to ensure sustainable protection for all participants."
    },
    {
      question: "How does the Liquidity Refund System work?",
      answer: (
        <div className="space-y-2">
          <p>Our system works through three main components:</p>
          <ol className="list-decimal pl-4 space-y-2">
            <li>
              <strong>Fee Collection:</strong> 20% of trading fees are allocated to the system
              (5% to stBTB holders, 15% to IL shield)
            </li>
            <li>
              <strong>Community Governance:</strong> stBTB holders vote on which trading pairs
              receive IL protection
            </li>
            <li>
              <strong>Treasury Management:</strong> The protocol actively manages various pairs
              to maintain the IL protection system
            </li>
          </ol>
        </div>
      )
    },
    {
      question: "What are the roles of different participants?",
      answer: (
        <div className="space-y-2">
          <p>BTB Finance has three main participant roles:</p>
          <ul className="list-disc pl-4 space-y-2">
            <li>
              <strong>Liquidity Providers (LPs):</strong> Provide liquidity to Uniswap V3 pools
              and receive IL protection
            </li>
            <li>
              <strong>BTB Voters:</strong> Stake BTB to receive stBTB, participate in governance,
              and earn rewards
            </li>
            <li>
              <strong>Treasury:</strong> Manages protocol assets and ensures sustainable IL protection
            </li>
          </ul>
        </div>
      )
    },
    {
      question: "How is the fee distribution structured?",
      answer: (
        <div className="space-y-2">
          <p>The fee structure is designed to be sustainable and fair:</p>
          <ul className="list-disc pl-4 space-y-2">
            <li>80% goes to Liquidity Providers</li>
            <li>10% goes to BTB Voters</li>
            <li>10% goes to Treasury</li>
          </ul>
          <p>Additionally, from the 20% profit cut:</p>
          <ul className="list-disc pl-4 space-y-2">
            <li>5% goes to stBTB holders</li>
            <li>15% goes to the IL shield</li>
          </ul>
        </div>
      )
    },
    {
      question: "How do I get started with BTB Finance?",
      answer: (
        <div className="space-y-2">
          <p>Getting started is simple:</p>
          <ol className="list-decimal pl-4 space-y-2">
            <li>Connect your wallet</li>
            <li>Stake BTB tokens to receive stBTB (1:1 ratio, 30-day lock)</li>
            <li>Participate in governance by voting on IL-protected pairs</li>
            <li>Provide liquidity to protected pairs on Uniswap V3</li>
            <li>Start earning fees while being protected from IL</li>
          </ol>
        </div>
      )
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white">
      <Header />
      
      <section className="pt-20 md:pt-32 pb-12 md:pb-16 px-4 md:px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6">
              About BTB Finance
            </h1>
            <p className="text-lg sm:text-xl text-gray-300">
              Learn how we&apos;re revolutionizing DeFi by protecting liquidity providers
              from impermanent loss.
            </p>
          </div>

          {/* Mission Statement */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl md:rounded-2xl p-6 md:p-8 mb-12 md:mb-16">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 md:mb-4">Our Mission</h2>
            <div className="prose prose-invert max-w-none">
              <p>
                BTB Finance aims to solve one of DeFi&apos;s biggest challenges: impermanent loss.
                By providing a sustainable protection mechanism through our innovative Liquidity
                Refund System, we&apos;re making DeFi safer and more accessible for everyone.
              </p>
              <p>
                Our community-driven approach ensures that protection is provided where it&apos;s
                needed most, while our smart fee distribution system maintains long-term
                sustainability.
              </p>
              <p className="text-lg text-[var(--text-secondary)] mb-8">
                We&apos;re building the future of DeFi, where liquidity providers can participate without fear of impermanent loss.
              </p>
              <p className="text-lg text-[var(--text-secondary)] mb-8">
                BTB Finance&apos;s innovative Liquidity Refund System ensures that LPs can confidently provide liquidity while being protected.
              </p>
              <p className="text-lg text-[var(--text-secondary)] mb-12">
                Join us in creating a more sustainable and efficient DeFi ecosystem where everyone&apos;s interests are aligned.
              </p>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mb-12 md:mb-16">
            <h2 className="text-xl sm:text-2xl font-bold mb-6 md:mb-8">Frequently Asked Questions</h2>
            <div className="space-y-2">
              {faqs.map((faq) => (
                <FaqItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
          </div>

          {/* Join Community Section */}
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 md:mb-4">Join Our Community</h2>
            <p className="text-gray-400 mb-8">
              Be part of the future of DeFi. Join our community and help shape the
              future of liquidity provision.
            </p>
            <div className="flex justify-center gap-4">
              <a
                href="https://discord.gg/bqFEPA56Tc"
                target="_blank"
                rel="noopener noreferrer"
                className="gradient-border glow px-6 sm:px-8 py-3 sm:py-4 bg-[var(--background-light)] text-lg font-medium hover:bg-[var(--background-dark)] transition-colors flex items-center"
              >
                <Icons.Discord className="w-6 h-6 mr-2" />
                Join Discord
              </a>
              <a
                href="https://twitter.com/btb_finance"
                target="_blank"
                rel="noopener noreferrer"
                className="gradient-border glow px-6 sm:px-8 py-3 sm:py-4 bg-[var(--background-light)] text-lg font-medium hover:bg-[var(--background-dark)] transition-colors flex items-center"
              >
                <Icons.Twitter className="w-6 h-6 mr-2" />
                Follow Twitter
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
