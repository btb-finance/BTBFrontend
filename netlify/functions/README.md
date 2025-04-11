# Subscription Jackpot Batch Processing

This scheduled function automatically processes the daily batch for the Subscription Jackpot contract.

## Setup

1. Update the contract address in `process-daily-batch.ts`:
   ```typescript
   const SUBSCRIPTION_JACKPOT_ADDRESS = 'YOUR_CONTRACT_ADDRESS_HERE';
   ```

2. Set the following environment variables in your Netlify dashboard:
   - `ETH_RPC_URL` - Your Ethereum RPC provider URL (e.g., Infura, Alchemy)
   - `PRIVATE_KEY` - The private key for the wallet that will execute the transactions

   **IMPORTANT**: Keep your private key secure! Ensure it's set as an environment variable in Netlify's UI and never commit it to your repository.

3. The function is scheduled to run daily at midnight UTC, but you can modify the schedule in `netlify.toml`:
   ```toml
   [[scheduled]]
     function = "process-daily-batch"
     schedule = "@daily" # Run daily at midnight UTC
   ```

   Other scheduling options:
   - `"@hourly"` - Run once an hour at the beginning of the hour
   - `"@daily"` - Run once a day at midnight UTC
   - `"@weekly"` - Run once a week at midnight UTC on Sunday
   - `"@monthly"` - Run once a month at midnight UTC on the first day of the month
   - `"@yearly"` - Run once a year at midnight UTC on January 1
   - `"* * * * *"` - Cron syntax (minute, hour, day of month, month, day of week)

## Manual Trigger

You can also trigger the function manually by making a GET request to:
```
https://your-netlify-site.netlify.app/.netlify/functions/process-daily-batch
```

## Testing Locally

To test locally:
1. Install the Netlify CLI: `npm install -g netlify-cli`
2. Create a `.env` file in the root with your environment variables
3. Run: `netlify dev`
4. Test the function: `curl http://localhost:8888/.netlify/functions/process-daily-batch` 