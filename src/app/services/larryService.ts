import { ethers } from 'ethers';
import larryABI from '../larryecosystem/larryabi.json';

const LARRY_CONTRACT_ADDRESS = '0x888d81e3ea5E8362B5f69188CBCF34Fa8da4b888';

class LarryService {
  private getProvider() {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return new ethers.BrowserProvider((window as any).ethereum);
    }
    // Use a public RPC endpoint for Base network
    return new ethers.JsonRpcProvider('https://base.llamarpc.com');
  }

  private getContract(signer?: ethers.Signer) {
    const provider = this.getProvider();
    return new ethers.Contract(
      LARRY_CONTRACT_ADDRESS,
      larryABI,
      signer || provider
    );
  }

  async getCurrentPrice() {
    try {
      const contract = this.getContract();
      const price = await contract.lastPrice();
      return ethers.formatEther(price);
    } catch (error) {
      console.error('Error fetching price:', error);
      return '0';
    }
  }

  async getTokenMetrics() {
    try {
      const contract = this.getContract();
      const [backing, totalSupply, price] = await Promise.all([
        contract.getBacking(),
        contract.totalSupply(),
        contract.lastPrice()
      ]);

      return {
        backing: ethers.formatEther(backing),
        totalSupply: ethers.formatEther(totalSupply),
        price: ethers.formatEther(price)
      };
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return {
        backing: '0',
        totalSupply: '0',
        price: '0'
      };
    }
  }

  async getUserBalance(address: string) {
    try {
      const contract = this.getContract();
      const balance = await contract.balanceOf(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0';
    }
  }

  async getContractStatus() {
    try {
      const contract = this.getContract();
      const [totalBorrowed, totalCollateral, buyFee, sellFee] = await Promise.all([
        contract.getTotalBorrowed(),
        contract.getTotalCollateral(),
        contract.buy_fee(),
        contract.sell_fee()
      ]);

      return {
        totalBorrowed: ethers.formatEther(totalBorrowed),
        totalCollateral: ethers.formatEther(totalCollateral),
        buyFee: ((10000 - buyFee) / 100).toFixed(2),
        sellFee: ((10000 - sellFee) / 100).toFixed(2)
      };
    } catch (error) {
      console.error('Error fetching status:', error);
      return {
        totalBorrowed: '0',
        totalCollateral: '0',
        buyFee: '0',
        sellFee: '0'
      };
    }
  }

  async getUserLoan(address: string) {
    try {
      const contract = this.getContract();
      const loan = await contract.Loans(address);
      
      return {
        collateral: ethers.formatEther(loan.collateral),
        borrowed: ethers.formatEther(loan.borrowed),
        endDate: loan.endDate.toString(),
        numberOfDays: loan.numberOfDays.toString()
      };
    } catch (error) {
      console.error('Error fetching loan:', error);
      return {
        collateral: '0',
        borrowed: '0',
        endDate: '0',
        numberOfDays: '0'
      };
    }
  }

  async quoteBuy(ethAmount: string) {
    try {
      const contract = this.getContract();
      const ethValue = ethers.parseEther(ethAmount);
      const tokenAmount = await contract.getBuyAmount(ethValue);
      const buyFee = await contract.buy_fee();
      
      return {
        tokenAmount: ethers.formatEther(tokenAmount),
        buyFee: ((10000 - buyFee) / 100).toFixed(2)
      };
    } catch (error) {
      console.error('Error getting buy quote:', error);
      return null;
    }
  }

  async quoteSell(larryAmount: string) {
    try {
      const contract = this.getContract();
      const larryValue = ethers.parseEther(larryAmount);
      const ethAmount = await contract.LARRYtoETH(larryValue);
      const sellFee = await contract.sell_fee();
      
      return {
        ethAmount: ethers.formatEther(ethAmount),
        sellFee: ((10000 - sellFee) / 100).toFixed(2)
      };
    } catch (error) {
      console.error('Error getting sell quote:', error);
      return null;
    }
  }

  async quoteLeverage(ethAmount: string, days: string) {
    try {
      const contract = this.getContract();
      const ethValue = ethers.parseEther(ethAmount);
      
      // Calculate leverage fee for this ETH amount and days
      const fee = await contract.leverageFee(ethValue, days);
      
      // Calculate LARRY tokens that will be minted for this leverage position
      const userETH = ethValue - BigInt(fee);
      const subValue = (fee * BigInt(3)) / BigInt(10) + ethValue / BigInt(100); // 30% of fee + 1% overcollateralization
      const larryAmount = await contract.ETHtoLARRYLev(userETH, subValue);
      
      // Calculate how much user needs to pay (fee + 1% overcollateralization)
      const requiredEth = (fee + ethValue / BigInt(100));
      
      const apr = 3.9; // Base APR
      
      return {
        ethPosition: ethers.formatEther(ethValue),
        larryAmount: ethers.formatEther(larryAmount),
        totalFee: ethers.formatEther(fee),
        requiredEth: ethers.formatEther(requiredEth),
        borrowAmount: ethers.formatEther((userETH * BigInt(99)) / BigInt(100)), // 99% of userETH
        apr: apr.toFixed(2)
      };
    } catch (error) {
      console.error('Error getting leverage quote:', error);
      return null;
    }
  }

  async quoteBorrow(ethAmount: string, days: string) {
    try {
      const contract = this.getContract();
      const ethValue = ethers.parseEther(ethAmount);
      const interestFee = await contract.getInterestFee(ethValue, days);
      const requiredCollateral = await contract.ETHtoLARRYNoTradeCeil(ethValue);
      const netAmount = (ethValue * BigInt(99)) / BigInt(100) - BigInt(interestFee);
      
      const apr = 3.9; // Base APR
      
      return {
        requiredCollateral: ethers.formatEther(requiredCollateral),
        interestFee: ethers.formatEther(interestFee),
        netAmount: ethers.formatEther(netAmount),
        apr: apr.toFixed(2)
      };
    } catch (error) {
      console.error('Error getting borrow quote:', error);
      return null;
    }
  }

  async buyTokens(ethAmount: string) {
    const provider = this.getProvider();
    const signer = await provider.getSigner();
    const contract = this.getContract(signer);
    
    const value = ethers.parseEther(ethAmount);
    const address = await signer.getAddress();
    
    return contract.buy(address, { value });
  }

  async sellTokens(larryAmount: string) {
    const provider = this.getProvider();
    const signer = await provider.getSigner();
    const contract = this.getContract(signer);
    
    const amount = ethers.parseEther(larryAmount);
    return contract.sell(amount);
  }

  async leverage(ethAmount: string, days: string) {
    const provider = this.getProvider();
    const signer = await provider.getSigner();
    const contract = this.getContract(signer);
    
    const ethValue = ethers.parseEther(ethAmount);
    
    // Calculate required fee and payment
    const fee = await contract.leverageFee(ethValue, days);
    const totalRequired = (fee + ethValue / BigInt(100)); // fee + 1% overcollateralization
    
    return contract.leverage(ethValue, days, { value: totalRequired });
  }

  async borrow(ethAmount: string, days: string) {
    const provider = this.getProvider();
    const signer = await provider.getSigner();
    const contract = this.getContract(signer);
    
    const amount = ethers.parseEther(ethAmount);
    return contract.borrow(amount, days);
  }

  async repay(amount: string) {
    const provider = this.getProvider();
    const signer = await provider.getSigner();
    const contract = this.getContract(signer);
    
    const value = ethers.parseEther(amount);
    return contract.repay({ value });
  }

  async extendLoan(days: string) {
    const provider = this.getProvider();
    const signer = await provider.getSigner();
    const contract = this.getContract(signer);
    const address = await signer.getAddress();
    
    // Get current loan to calculate extension fee
    const loan = await contract.Loans(address);
    const fee = await contract.getInterestFee(loan.borrowed, days);
    
    return contract.extendLoan(days, { value: fee });
  }

  async borrowMore(ethAmount: string) {
    const provider = this.getProvider();
    const signer = await provider.getSigner();
    const contract = this.getContract(signer);
    
    const amount = ethers.parseEther(ethAmount);
    return contract.borrowMore(amount);
  }

  async removeCollateral(larryAmount: string) {
    const provider = this.getProvider();
    const signer = await provider.getSigner();
    const contract = this.getContract(signer);
    
    const amount = ethers.parseEther(larryAmount);
    return contract.removeCollateral(amount);
  }

  async closePosition() {
    const provider = this.getProvider();
    const signer = await provider.getSigner();
    const contract = this.getContract(signer);
    const address = await signer.getAddress();
    
    // Get loan amount to repay
    const loan = await contract.Loans(address);
    
    return contract.closePosition({ value: loan.borrowed });
  }

  async quoteFlashClose(address: string) {
    try {
      const contract = this.getContract();
      const loan = await contract.Loans(address);
      
      if (loan.collateral.toString() === '0') {
        return null;
      }
      
      // Calculate what user will get from flash close
      const collateralInETH = await contract.LARRYtoETH(loan.collateral);
      const collateralInETHAfterFee = (collateralInETH * BigInt(99)) / BigInt(100); // 99% after 1% fee
      const borrowed = loan.borrowed;
      
      // Fee breakdown
      const fee = collateralInETH / BigInt(100); // 1% fee
      const feeAddressFee = (fee * BigInt(3)) / BigInt(10); // 30% of fee goes to fee address
      
      // What user gets
      const toUser = collateralInETHAfterFee - BigInt(borrowed);
      
      return {
        collateralValue: ethers.formatEther(collateralInETH),
        borrowed: ethers.formatEther(borrowed),
        totalFee: ethers.formatEther(fee),
        feeAddressFee: ethers.formatEther(feeAddressFee),
        userReceives: ethers.formatEther(toUser),
        canClose: collateralInETHAfterFee.gte(borrowed)
      };
    } catch (error) {
      console.error('Error getting flash close quote:', error);
      return null;
    }
  }

  async flashClosePosition() {
    const provider = this.getProvider();
    const signer = await provider.getSigner();
    const contract = this.getContract(signer);
    
    return contract.flashClosePosition();
  }
}

export default new LarryService();