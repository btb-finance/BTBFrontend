// BTB.finance API Service
// This service handles API communication with BTB.finance dashboard

const BASE_URL = 'https://btb.finance/api';

export interface Portfolio {
  totalValue: number;
  totalEarnings: number;
  averageApy: number;
  activePositions: number;
  performanceHistory: {
    date: string;
    value: number;
  }[];
}

export interface Position {
  id: string;
  protocol: string;
  pair: string;
  tvl: number | string;
  apy: number | string;
  rewards: number | any[];
  risk: 'Low' | 'Medium' | 'High';
  health: 'Healthy' | 'Warning' | 'Alert';
  chain?: string;
  details?: {
    startDate: string;
    totalRewards: number;
    recentTransactions: {
      date: string;
      action: string;
      amount: number;
      token: string;
    }[];
  };
}

export interface MarketData {
  topProtocols: {
    name: string;
    tvl: number;
    change24h: number;
  }[];
  topPairs: {
    name: string;
    volume24h: number;
    apy: number;
  }[];
}

export interface Alert {
  id: string;
  type: 'Info' | 'Warning' | 'Opportunity';
  message: string;
  timestamp: string;
  read: boolean;
}

class BTBApi {
  private authToken: string | null = null;
  
  setAuthToken(token: string) {
    this.authToken = token;
  }
  
  clearAuthToken() {
    this.authToken = null;
  }
  
  private getHeaders() {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }
  
  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    try {
      // Check if we're in development mode (localhost)
      const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      
      if (isDevelopment) {
        console.log(`Dev mode: would fetch ${endpoint}`);
        
        // Determine which mock method to call based on the endpoint
        switch (endpoint) {
          case '/portfolio/overview':
            return await this.mockPortfolioOverview();
          case '/portfolio/positions':
            return await this.mockPositions();
          case '/market/overview':
            return await this.mockMarketOverview();
          case '/alerts':
            return await this.mockAlerts();
          default:
            // For any other endpoints, check if it's a position details request
            if (endpoint.startsWith('/portfolio/positions/')) {
              const position = await this.mockPositions();
              const positionId = endpoint.split('/').pop();
              return position.find(p => p.id === positionId) || position[0];
            }
            console.warn(`No mock data available for endpoint: ${endpoint}`);
            return {};
        }
      }
      
      // For production, make the actual API call
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: this.getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} - ${await response.text()}`);
      }
      
      return response.json();
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      
      // If the fetch fails (e.g., due to CORS), fall back to mock data
      console.log(`Falling back to mock data for ${endpoint}`);
      
      // Determine which mock method to call based on the endpoint
      switch (endpoint) {
        case '/portfolio/overview':
          return await this.mockPortfolioOverview();
        case '/portfolio/positions':
          return await this.mockPositions();
        case '/market/overview':
          return await this.mockMarketOverview();
        case '/alerts':
          return await this.mockAlerts();
        default:
          // For any other endpoints, check if it's a position details request
          if (endpoint.startsWith('/portfolio/positions/')) {
            const position = await this.mockPositions();
            const positionId = endpoint.split('/').pop();
            return position.find(p => p.id === positionId) || position[0];
          }
          console.warn(`No mock data available for endpoint: ${endpoint}`);
          return {};
      }
    }
  }
  
  // Auth endpoints
  async connectWithWallet(address: string, signature: string): Promise<{ token: string }> {
    try {
      // In development, if we're on localhost, return a mock token directly
      // This helps avoid CORS issues when testing locally
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        console.log('Development environment detected, using mock authentication');
        const mockToken = `dev_${Date.now()}_${address.substring(0, 8)}`;
        this.setAuthToken(mockToken);
        return { token: mockToken };
      }
      
      // For production, attempt the real API call
      const response = await fetch(`${BASE_URL}/auth/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, signature }),
      });
      
      if (!response.ok) {
        throw new Error(`Auth error: ${response.status}`);
      }
      
      const data = await response.json();
      this.setAuthToken(data.token);
      return data;
    } catch (error) {
      console.error('BTB wallet connection error:', error);
      
      // If the API call fails for any reason (including CORS), fall back to mock authentication
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.log('API connection failed, falling back to mock authentication');
        const mockToken = `mock_${Date.now()}_${address.substring(0, 8)}`;
        this.setAuthToken(mockToken);
        return { token: mockToken };
      }
      
      throw error;
    }
  }
  
  // Portfolio endpoints
  async getPortfolioOverview(): Promise<Portfolio> {
    return this.fetchWithAuth('/portfolio/overview');
  }
  
  async getPositions(): Promise<Position[]> {
    return this.fetchWithAuth('/portfolio/positions');
  }
  
  async getPositionDetails(positionId: string): Promise<Position> {
    return this.fetchWithAuth(`/portfolio/positions/${positionId}`);
  }
  
  // Market data
  async getMarketOverview(): Promise<MarketData> {
    return this.fetchWithAuth('/market/overview');
  }
  
  // Alerts
  async getAlerts(): Promise<Alert[]> {
    return this.fetchWithAuth('/alerts');
  }
  
  async markAlertAsRead(alertId: string): Promise<void> {
    return this.fetchWithAuth(`/alerts/${alertId}/read`, {
      method: 'POST',
    });
  }
  
  // Mock API - For development and testing
  // These methods simulate API calls when actual API is not available
  async mockPortfolioOverview(): Promise<Portfolio> {
    return {
      totalValue: 124592,
      totalEarnings: 12789,
      averageApy: 24.5,
      activePositions: 8,
      performanceHistory: [
        { date: '2023-01-01', value: 95000 },
        { date: '2023-02-01', value: 102000 },
        { date: '2023-03-01', value: 98000 },
        { date: '2023-04-01', value: 115000 },
        { date: '2023-05-01', value: 124000 },
        { date: '2023-06-01', value: 124592 }
      ]
    };
  }
  
  async mockPositions(): Promise<Position[]> {
    return [
      {
        id: '1',
        protocol: 'Uniswap V3',
        pair: 'ETH/USDC',
        tvl: 45230,
        apy: 28.4,
        rewards: 234.12,
        risk: 'Medium',
        health: 'Healthy'
      },
      {
        id: '2',
        protocol: 'Curve Finance',
        pair: 'stETH/ETH',
        tvl: 32180,
        apy: 12.8,
        rewards: 89.45,
        risk: 'Low',
        health: 'Healthy'
      },
      {
        id: '3',
        protocol: 'Balancer',
        pair: 'BTC/ETH/USDC',
        tvl: 28940,
        apy: 18.2,
        rewards: 142.30,
        risk: 'Medium',
        health: 'Warning'
      },
      {
        id: '4',
        protocol: 'Aave V3',
        pair: 'ETH Supply',
        tvl: 18242,
        apy: 4.2,
        rewards: 21.15,
        risk: 'Low',
        health: 'Healthy'
      }
    ];
  }
  
  async mockMarketOverview(): Promise<MarketData> {
    return {
      topProtocols: [
        { name: 'Uniswap', tvl: 4580000000, change24h: 1.2 },
        { name: 'Curve', tvl: 3250000000, change24h: -0.8 },
        { name: 'Aave', tvl: 2850000000, change24h: 0.5 },
        { name: 'Balancer', tvl: 1920000000, change24h: 2.3 },
        { name: 'Compound', tvl: 1750000000, change24h: -1.1 }
      ],
      topPairs: [
        { name: 'ETH/USDC', volume24h: 325000000, apy: 28.4 },
        { name: 'BTC/USDT', volume24h: 290000000, apy: 15.2 },
        { name: 'ETH/BTC', volume24h: 185000000, apy: 12.8 },
        { name: 'ETH/USDT', volume24h: 175000000, apy: 14.5 },
        { name: 'USDC/USDT', volume24h: 158000000, apy: 8.9 }
      ]
    };
  }
  
  async mockAlerts(): Promise<Alert[]> {
    return [
      {
        id: '1',
        type: 'Warning',
        message: 'Your Balancer position (BTC/ETH/USDC) has dropped below optimal range',
        timestamp: '2023-06-15T09:23:45Z',
        read: false
      },
      {
        id: '2',
        type: 'Opportunity',
        message: 'New farming opportunity: MATIC/ETH pool on Uniswap with 32% APY',
        timestamp: '2023-06-14T15:12:30Z',
        read: true
      },
      {
        id: '3',
        type: 'Info',
        message: 'Your weekly earnings report is now available',
        timestamp: '2023-06-13T22:45:10Z',
        read: false
      },
      {
        id: '4',
        type: 'Opportunity',
        message: 'Base: New Baseswap ETH/USDC pool offering 24% APY',
        timestamp: '2023-06-16T14:05:22Z',
        read: false
      },
      {
        id: '5',
        type: 'Info',
        message: 'Optimism: Velodrome ETH/USDC pool liquidity has increased by 35%',
        timestamp: '2023-06-16T10:12:08Z',
        read: false
      },
      {
        id: '6',
        type: 'Warning',
        message: 'Arbitrum: Your SushiSwap ETH/USDC position is now below target range',
        timestamp: '2023-06-15T22:33:15Z',
        read: false
      },
      {
        id: '7',
        type: 'Opportunity',
        message: 'Base: New Aerodrome ETH/USDC pool launched with 18% APY',
        timestamp: '2023-06-16T08:45:30Z',
        read: false
      }
    ];
  }
}

// Export singleton instance
const btbApi = new BTBApi();
export default btbApi;
