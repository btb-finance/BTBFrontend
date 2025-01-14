'use client';

interface Proposal {
  id: number;
  title: string;
  description: string;
  status: 'active' | 'pending' | 'closed';
  votesFor: number;
  votesAgainst: number;
  endTime: Date;
}

interface ProposalCardProps {
  proposal: Proposal;
}

export const ProposalCard = ({ proposal }: ProposalCardProps) => {
  const totalVotes = proposal.votesFor + proposal.votesAgainst;
  const forPercentage = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
  
  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 transition-all hover:scale-[1.01]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold mb-2">{proposal.title}</h3>
          <p className="text-gray-400">{proposal.description}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm ${
          proposal.status === 'active' ? 'bg-green-500/20 text-green-400' :
          proposal.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-gray-500/20 text-gray-400'
        }`}>
          {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
        </span>
      </div>

      <div className="mb-4">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${forPercentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-400">
          <span>{forPercentage.toFixed(1)}% For</span>
          <span>{(100 - forPercentage).toFixed(1)}% Against</span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-400">
          Ends {proposal.endTime.toLocaleDateString()}
        </div>
        {proposal.status === 'active' && (
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm transition-colors">
              Vote For
            </button>
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors">
              Vote Against
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
