# 🐣 BTB Finance - CHICKS Token Frontend

<div align="center">
  <img src="public/images/btblogo.jpg" alt="BTB Finance Logo" width="200"/>
  
  <p>
    <b>100% USDC-Backed | Real-Time Stats | DeFi Yield Protocol</b>
  </p>

  <div>
    <a href="https://btb.finance"><img src="https://img.shields.io/badge/website-btb.finance-blue?style=for-the-badge" alt="Website"></a>
    <a href="#"><img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License"></a>
  </div>
  
  <br/>
  
  <div>
    <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js">
    <img src="https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind">
    <img src="https://img.shields.io/badge/TypeScript-4.9-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
    <img src="https://img.shields.io/badge/ethers.js-5.8.0-3C3C3D?style=flat-square" alt="ethers.js">
  </div>
</div>

<br/>

<p align="center">
  <b>🚀 A modern DeFi frontend for the CHICKS token ecosystem 🚀</b>
</p>

---

## 📋 Project Overview

BTB Finance's frontend application provides a user-friendly interface for interacting with the CHICKS token ecosystem. This Next.js application enables users to:

- 💰 Buy and sell CHICKS tokens
- 💸 Borrow USDC against CHICKS collateral
- 🔄 Manage loans and positions
- 📊 View real-time stats and analytics

The application is built with modern web technologies and connects to Ethereum-compatible blockchains (Base Sepolia testnet for development).

---

## 🚀 Features

<table>
  <tr>
    <td width="50%" align="center">
      <h3>💰 100% USDC-Backed</h3>
      <p>Every CHICKS token is fully backed by USDC, ensuring stability and trust</p>
    </td>
    <td width="50%" align="center">
      <h3>📈 Real-Time Stats</h3>
      <p>Monitor key metrics like TVL, price, and APY in real-time</p>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <h3>🔒 Secure Borrowing</h3>
      <p>Borrow USDC against your CHICKS holdings with transparent terms</p>
    </td>
    <td width="50%" align="center">
      <h3>🌐 Web3 Integration</h3>
      <p>Seamless connection to popular Web3 wallets</p>
    </td>
  </tr>
</table>

---

## 🛠️ Tech Stack

<div align="center">
  <table>
    <tr>
      <td align="center"><img src="https://cdn.worldvectorlogo.com/logos/next-js.svg" width="40"/><br/>Next.js 15</td>
      <td align="center"><img src="https://cdn.worldvectorlogo.com/logos/tailwindcss.svg" width="40"/><br/>Tailwind CSS</td>
      <td align="center"><img src="https://cdn.worldvectorlogo.com/logos/typescript.svg" width="40"/><br/>TypeScript</td>
      <td align="center"><img src="https://cdn.worldvectorlogo.com/logos/ethereum-1.svg" width="40"/><br/>ethers.js</td>
    </tr>
  </table>
</div>

- **🔗 Web3**: ethers.js for blockchain interaction
- **🎨 UI**: Tailwind CSS for styling and responsive design
- **🧠 State Management**: React Context API
- **🔄 Routing**: Next.js App Router

---

## 📊 Key Components

- **Trade Page**: Buy and sell CHICKS tokens
- **Borrow Page**: Borrow USDC against CHICKS collateral
- **Dashboard**: View stats and analytics
- **Wallet Integration**: Connect with MetaMask and other wallets

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- pnpm package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/btb-finance/BTBFrontend.git
cd BTBFrontend
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
Create a `.env.local` file with the following:
```
NEXT_PUBLIC_CHICKS_CONTRACT_ADDRESS=your_contract_address
NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=your_usdc_address
```

4. Run the development server:
```bash
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) to see the application!

---

## 🌐 Deployment

### Vercel (Recommended)

1. Fork this repository
2. Create a new project on [Vercel](https://vercel.com)
3. Connect your forked repository
4. Add environment variables
5. Deploy!

### Self-Hosted

1. Build the production version:
```bash
pnpm run build
```

2. Start the production server:
```bash
pnpm start
```

---

## 🧪 Testing

Run the test suite with:

```bash
pnpm test
```

---

## 👥 Community & Support

<div align="center">
  <a href="https://btb.finance"><img src="https://img.shields.io/badge/Website-btb.finance-blue?style=for-the-badge" alt="Website"></a>
  <a href="https://twitter.com/BTB_Finance"><img src="https://img.shields.io/badge/Twitter-@BTB__Finance-1DA1F2?style=for-the-badge&logo=twitter" alt="Twitter"></a>
  <a href="https://discord.gg/bqFEPA56Tc"><img src="https://img.shields.io/badge/Discord-Join%20Us-7289DA?style=for-the-badge&logo=discord" alt="Discord"></a>
</div>

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <h3>Built with ❤️ by the BTB Finance Team</h3>
  <p>© 2025 BTB Finance. All rights reserved.</p>
</div>
