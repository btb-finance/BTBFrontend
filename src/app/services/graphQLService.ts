import { createClient } from 'urql';
import { cacheExchange, fetchExchange } from '@urql/core';

// GraphQL client for interacting with The Graph subgraphs
class GraphQLService {
  private static instance: GraphQLService;
  private clients: Map<string, any>;

  private constructor() {
    this.clients = new Map();
  }

  public static getInstance(): GraphQLService {
    if (!GraphQLService.instance) {
      GraphQLService.instance = new GraphQLService();
    }
    return GraphQLService.instance;
  }

  // Get or create a client for a specific subgraph
  public getClient(subgraphId: string, apiKey: string = ''): any {
    const clientKey = `${subgraphId}:${apiKey}`;

    if (!this.clients.has(clientKey)) {
      // Build the URL
      let url: string;
      
      if (apiKey) {
        // With API key
        url = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`;
      } else {
        // Without API key (may use a public endpoint or another configuration)
        url = `https://api.thegraph.com/subgraphs/id/${subgraphId}`;
      }
      
      const client = createClient({
        url,
        exchanges: [cacheExchange, fetchExchange],
      });
      
      this.clients.set(clientKey, client);
    }
    
    return this.clients.get(clientKey);
  }

  // Execute a query against a subgraph
  public async executeQuery(query: string, subgraphId: string, apiKey: string = '', variables: any = {}): Promise<any> {
    const client = this.getClient(subgraphId, apiKey);
    
    try {
      const result = await client.query(query, variables).toPromise();
      
      if (result.error) {
        console.error('GraphQL query error:', result.error);
        throw new Error(result.error.message);
      }
      
      return result.data;
    } catch (error) {
      console.error('Failed to execute GraphQL query:', error);
      throw error;
    }
  }
}

export default GraphQLService;
