interface DailyPrizeWinner {
  jackpotRoundId: string;
  claimTransactionHash: string;
  claimedTimestamp: string;
  prizeValue: string;
}

interface DailyPrizeResponse {
  winners: DailyPrizeWinner[];
  totalPrizes: number;
  totalValue: string;
}

export class MegapotAPI {
  private baseUrl = 'https://api.megapot.io';
  private apiKey: string | null = null;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_MEGAPOT_API_KEY || null;
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getDailyPrizeWinners(walletAddress: string): Promise<DailyPrizeResponse> {
    try {
      const response = await this.makeRequest<DailyPrizeResponse>(
        `/api/v1/giveaways/daily-giveaway-winners/${walletAddress}`
      );
      return response;
    } catch (error) {
      console.error('Error fetching daily prize winners:', error);
      throw error;
    }
  }

  async getUserTicketHistory(contractAddress: string, walletAddress: string) {
    try {
      const response = await this.makeRequest(
        `/api/v1/contracts/${contractAddress}/${walletAddress}`
      );
      return response;
    } catch (error) {
      console.error('Error fetching user ticket history:', error);
      throw error;
    }
  }

  async getJackpotHistory(contractAddress: string) {
    try {
      const response = await this.makeRequest(
        `/api/v1/contracts/${contractAddress}/jackpot-history`
      );
      return response;
    } catch (error) {
      console.error('Error fetching jackpot history:', error);
      throw error;
    }
  }
}

export const megapotAPI = new MegapotAPI();