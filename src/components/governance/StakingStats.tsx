'use client';

export const StakingStats = () => {
  // Mock data - will be replaced with actual blockchain data
  const stats = [
    {
      label: 'Total BTB Staked',
      value: '1,234,567 BTB',
      change: '+5.2%',
      positive: true,
    },
    {
      label: 'Staking APR',
      value: '12.4%',
      change: '+0.8%',
      positive: true,
    },
    {
      label: 'Your stBTB Balance',
      value: '0 stBTB',
      change: '0%',
      positive: false,
    },
    {
      label: 'Voting Power',
      value: '0%',
      change: '0%',
      positive: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 transition-all hover:scale-[1.01]"
          style={{
            animationDelay: `${index * 100}ms`,
            animation: 'fadeIn 0.5s ease-out forwards',
          }}
        >
          <h3 className="text-sm text-gray-400 mb-2">{stat.label}</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{stat.value}</span>
            <span className={`text-sm ${
              stat.positive ? 'text-green-400' : 'text-gray-400'
            }`}>
              {stat.change}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
