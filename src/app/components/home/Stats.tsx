'use client';

const stats = [
  { id: 1, name: 'Active Users', value: '10,000+' },
  { id: 2, name: 'Calculations Made', value: '1M+' },
  { id: 3, name: 'Total Value Analyzed', value: '$500M+' },
  { id: 4, name: 'Community Members', value: '25,000+' },
];

export default function Stats() {
  return (
    <div className="bg-blue-600 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Trusted by yield farmers worldwide
            </h2>
            <p className="mt-4 text-lg leading-8 text-blue-200">
              Join thousands of DeFi enthusiasts who trust our platform for their yield farming decisions
            </p>
          </div>
          <dl className="mt-16 grid grid-cols-1 gap-0.5 overflow-hidden rounded-2xl text-center sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.id} className="flex flex-col bg-white/5 p-8 backdrop-blur-lg">
                <dt className="text-sm font-semibold leading-6 text-blue-200">{stat.name}</dt>
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
