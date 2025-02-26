'use client';

const stats = [
  { id: 1, name: 'Total Value Locked', value: '$100M+' },
  { id: 2, name: 'BTB Token Holders', value: '50,000+' },
  { id: 3, name: 'Yield Farming Pools', value: '100+' },
  { id: 4, name: 'Global Community', value: '100,000+' },
];

export default function Stats() {
  return (
    <div className="bg-btb-gradient py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Leading the DeFi Revolution
            </h2>
            <p className="mt-4 text-lg leading-8 text-blue-100">
              Join the BTB Finance ecosystem and be part of the future of decentralized finance
            </p>
          </div>
          <dl className="mt-16 grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl text-center sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.id} className="flex flex-col bg-white/5 p-8 backdrop-blur-lg">
                <dt className="text-sm font-semibold leading-6 text-blue-100">{stat.name}</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-white">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
