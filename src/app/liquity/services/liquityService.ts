import { ethers } from "ethers";
import { PoolInfo, UserPosition, LiquidityPosition } from "../types/liquity";
import { priceToTick, sqrtPriceX96ToPrice } from "../utils/rangeCalculations";

// Uniswap V3 contract addresses (example - update with actual addresses)
const UNISWAP_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const NONFUNGIBLE_POSITION_MANAGER = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

// ABIs
const POOL_ABI = [
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function fee() external view returns (uint24)",
  "function liquidity() external view returns (uint128)",
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function tickSpacing() external view returns (int24)",
];

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
];

const POSITION_MANAGER_ABI = [
  "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function increaseLiquidity(tuple(uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function decreaseLiquidity(tuple(uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) external payable returns (uint256 amount0, uint256 amount1)",
  "function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) external payable returns (uint256 amount0, uint256 amount1)",
  "function burn(uint256 tokenId) external payable",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
];

const ERC20_ABI = [
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
];

class LiquityService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;

  /**
   * Initialize the service with provider and signer
   */
  async initialize(provider: ethers.BrowserProvider): Promise<void> {
    this.provider = provider;
    this.signer = await provider.getSigner();
  }

  /**
   * Get pool information
   */
  async getPoolInfo(
    token0Address: string,
    token1Address: string,
    fee: number
  ): Promise<PoolInfo> {
    if (!this.provider) throw new Error("Provider not initialized");

    const factory = new ethers.Contract(UNISWAP_V3_FACTORY, FACTORY_ABI, this.provider);
    const poolAddress = await factory.getPool(token0Address, token1Address, fee);

    if (poolAddress === ethers.ZeroAddress) {
      throw new Error("Pool does not exist");
    }

    const pool = new ethers.Contract(poolAddress, POOL_ABI, this.provider);
    const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, this.provider);
    const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, this.provider);

    const [token0, token1, poolFee, liquidity, slot0, token0Symbol, token1Symbol, token0Decimals, token1Decimals] =
      await Promise.all([
        pool.token0(),
        pool.token1(),
        pool.fee(),
        pool.liquidity(),
        pool.slot0(),
        token0Contract.symbol(),
        token1Contract.symbol(),
        token0Contract.decimals(),
        token1Contract.decimals(),
      ]);

    const currentPrice = sqrtPriceX96ToPrice(slot0.sqrtPriceX96);

    return {
      token0,
      token1,
      token0Symbol,
      token1Symbol,
      token0Decimals: Number(token0Decimals),
      token1Decimals: Number(token1Decimals),
      fee: Number(poolFee),
      liquidity,
      sqrtPriceX96: slot0.sqrtPriceX96,
      tick: Number(slot0.tick),
      currentPrice,
      totalValueLocked: liquidity, // Simplified
    };
  }

  /**
   * Get user's positions
   */
  async getUserPositions(userAddress: string): Promise<UserPosition[]> {
    if (!this.provider) throw new Error("Provider not initialized");

    const positionManager = new ethers.Contract(
      NONFUNGIBLE_POSITION_MANAGER,
      POSITION_MANAGER_ABI,
      this.provider
    );

    const balance = await positionManager.balanceOf(userAddress);
    const positions: UserPosition[] = [];

    for (let i = 0; i < Number(balance); i++) {
      const tokenId = await positionManager.tokenOfOwnerByIndex(userAddress, i);
      const position = await positionManager.positions(tokenId);

      positions.push({
        id: tokenId.toString(),
        tokenId,
        liquidity: position.liquidity,
        token0Amount: 0n, // Would need additional calculation
        token1Amount: 0n, // Would need additional calculation
        minTick: Number(position.tickLower),
        maxTick: Number(position.tickUpper),
        feesEarned0: position.tokensOwed0,
        feesEarned1: position.tokensOwed1,
        createdAt: Date.now(), // Would need to fetch from events
      });
    }

    return positions;
  }

  /**
   * Check and approve token if needed
   */
  async approveToken(
    tokenAddress: string,
    amount: bigint
  ): Promise<ethers.ContractTransactionResponse | null> {
    if (!this.provider || !this.signer) throw new Error("Provider or signer not initialized");

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
    const userAddress = await this.signer.getAddress();
    const allowance = await token.allowance(userAddress, NONFUNGIBLE_POSITION_MANAGER);

    if (allowance < amount) {
      const tx = await token.approve(NONFUNGIBLE_POSITION_MANAGER, ethers.MaxUint256);
      await tx.wait();
      return tx;
    }

    return null;
  }

  /**
   * Add liquidity to a new position
   */
  async addLiquidity(
    token0Address: string,
    token1Address: string,
    fee: number,
    minPrice: number,
    maxPrice: number,
    amount0Desired: bigint,
    amount1Desired: bigint,
    slippageTolerance: number = 0.5
  ): Promise<ethers.ContractTransactionResponse> {
    if (!this.provider || !this.signer) throw new Error("Provider or signer not initialized");

    // Approve tokens
    await this.approveToken(token0Address, amount0Desired);
    await this.approveToken(token1Address, amount1Desired);

    const positionManager = new ethers.Contract(
      NONFUNGIBLE_POSITION_MANAGER,
      POSITION_MANAGER_ABI,
      this.signer
    );

    const tickLower = priceToTick(minPrice);
    const tickUpper = priceToTick(maxPrice);

    // Calculate minimum amounts with slippage
    const amount0Min = (amount0Desired * BigInt(Math.floor((100 - slippageTolerance) * 100))) / 10000n;
    const amount1Min = (amount1Desired * BigInt(Math.floor((100 - slippageTolerance) * 100))) / 10000n;

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

    const params = {
      token0: token0Address,
      token1: token1Address,
      fee,
      tickLower,
      tickUpper,
      amount0Desired,
      amount1Desired,
      amount0Min,
      amount1Min,
      recipient: await this.signer.getAddress(),
      deadline,
    };

    const tx = await positionManager.mint(params);
    return tx;
  }

  /**
   * Increase liquidity for an existing position
   */
  async increaseLiquidity(
    tokenId: bigint,
    amount0Desired: bigint,
    amount1Desired: bigint,
    slippageTolerance: number = 0.5
  ): Promise<ethers.ContractTransactionResponse> {
    if (!this.provider || !this.signer) throw new Error("Provider or signer not initialized");

    const positionManager = new ethers.Contract(
      NONFUNGIBLE_POSITION_MANAGER,
      POSITION_MANAGER_ABI,
      this.signer
    );

    const amount0Min = (amount0Desired * BigInt(Math.floor((100 - slippageTolerance) * 100))) / 10000n;
    const amount1Min = (amount1Desired * BigInt(Math.floor((100 - slippageTolerance) * 100))) / 10000n;

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    const params = {
      tokenId,
      amount0Desired,
      amount1Desired,
      amount0Min,
      amount1Min,
      deadline,
    };

    const tx = await positionManager.increaseLiquidity(params);
    return tx;
  }

  /**
   * Decrease liquidity from a position
   */
  async decreaseLiquidity(
    tokenId: bigint,
    liquidity: bigint,
    slippageTolerance: number = 0.5
  ): Promise<ethers.ContractTransactionResponse> {
    if (!this.provider || !this.signer) throw new Error("Provider or signer not initialized");

    const positionManager = new ethers.Contract(
      NONFUNGIBLE_POSITION_MANAGER,
      POSITION_MANAGER_ABI,
      this.signer
    );

    const params = {
      tokenId,
      liquidity,
      amount0Min: 0n, // Could calculate based on slippage
      amount1Min: 0n,
      deadline: Math.floor(Date.now() / 1000) + 60 * 20,
    };

    const tx = await positionManager.decreaseLiquidity(params);
    return tx;
  }

  /**
   * Collect fees from a position
   */
  async collectFees(tokenId: bigint): Promise<ethers.ContractTransactionResponse> {
    if (!this.provider || !this.signer) throw new Error("Provider or signer not initialized");

    const positionManager = new ethers.Contract(
      NONFUNGIBLE_POSITION_MANAGER,
      POSITION_MANAGER_ABI,
      this.signer
    );

    const params = {
      tokenId,
      recipient: await this.signer.getAddress(),
      amount0Max: ethers.MaxUint128,
      amount1Max: ethers.MaxUint128,
    };

    const tx = await positionManager.collect(params);
    return tx;
  }

  /**
   * Remove position (must have 0 liquidity)
   */
  async removePosition(tokenId: bigint): Promise<ethers.ContractTransactionResponse> {
    if (!this.provider || !this.signer) throw new Error("Provider or signer not initialized");

    const positionManager = new ethers.Contract(
      NONFUNGIBLE_POSITION_MANAGER,
      POSITION_MANAGER_ABI,
      this.signer
    );

    const tx = await positionManager.burn(tokenId);
    return tx;
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<bigint> {
    if (!this.provider) throw new Error("Provider not initialized");

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    return await token.balanceOf(userAddress);
  }
}

export const liquityService = new LiquityService();
