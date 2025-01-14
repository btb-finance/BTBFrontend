# BTB Finance Website

## Tech Stack & Implementation

### Frontend Framework
- Next.js 14 (App Router)
- TypeScript 5.2
- React Server Components
- Dynamic imports for optimal loading

### Styling & UI
- Tailwind CSS with custom design system
- CSS Variables for theme customization
- CSS Grid for responsive layouts
- Framer Motion for animations
  - Page transitions
  - Scroll animations
  - Hover effects
- Custom UI components built from scratch

### Performance Optimization
- Next.js Image optimization
- Dynamic imports
- React Suspense boundaries
- Optimized font loading
- Responsive images
- Code splitting

### State Management
- React Context API
- Custom hooks for web3 integration
- SWR for data fetching
- Local storage persistence

### Web3 Integration
- ethers.js for blockchain interaction
- Web3Modal for wallet connections
- Chain-specific configurations
- Custom hooks for contract interactions

### Development Tools
- ESLint with custom config
- Prettier for code formatting
- PostCSS for CSS processing
- TypeScript strict mode
- Husky for git hooks

### SEO & Metadata
- Dynamic metadata generation
- JSON-LD structured data
- OpenGraph tags
- Twitter cards
- Sitemap generation

### Testing & Quality
- Jest for unit testing
- React Testing Library
- E2E tests with Playwright
- TypeScript strict mode
- ESLint for code quality

### CI/CD
- GitHub Actions workflow
- Automated testing
- Production builds
- Deployment checks

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js 14 app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── [...routes]/       # Other routes
├── components/            
│   ├── home/              # Home page components
│   ├── layout/            # Layout components
│   ├── shared/            # Shared components
│   └── ui/                # Reusable UI components
├── lib/                   
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   └── web3/              # Web3 integration
├── styles/                
│   ├── globals.css        # Global styles
│   └── variables.css      # CSS variables
└── types/                 # TypeScript types
```

## Connect With Us

- 𝕏 Twitter: [@btb_finance](https://twitter.com/btb_finance)
- Telegram: [BTBFinance](https://t.me/BTBFinance)
- Discord: [Join our community](https://discord.gg/bqFEPA56Tc)

## License

MIT License
