// Test script for Aave User Position

const https = require('https');

// Function to make HTTPS requests
function makeHttpsRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (response) => {
      let data = '';
      
      // A chunk of data has been received
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      // The whole response has been received
      response.on('end', () => {
        try {
          // Try to parse as JSON first
          const jsonData = JSON.parse(data);
          resolve({ status: response.statusCode, data: jsonData });
        } catch (error) {
          // If not valid JSON, return as string with status
          resolve({ status: response.statusCode, data: data });
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Test Aave API endpoints for user data
async function testAaveUserData() {
  console.log('Testing Aave V2 API for user data...');
  const AAVE_API_BASE_URL = 'https://aave-api-v2.aave.com';
  
  // Test multiple user addresses for better validation
  const testUsers = [
    { address: '0x7d12d0d36f8291e8f7adec4cf59df6cc01d0ab97', chainId: '1', description: 'Original test user' },
    { address: '0xf89d7b9c864f589bbF53a82105107622B35EaA40', chainId: '1', description: 'Large Aave user' },
    { address: '0x4862733b5fddfd35f35ea8ccf08f5045e57388b3', chainId: '1', description: 'Random user' }
  ];
  
  // Test TVL endpoint first which we know works
  try {
    const tvlUrl = `${AAVE_API_BASE_URL}/data/tvl`;
    console.log(`Testing TVL endpoint: ${tvlUrl}`);
    const tvlResponse = await makeHttpsRequest(tvlUrl);
    
    if (tvlResponse.status === 200 && typeof tvlResponse.data === 'object') {
      console.log('TVL API call successful');
      console.log(`Current TVL: $${tvlResponse.data.totalTvlUSD ? tvlResponse.data.totalTvlUSD.toLocaleString() : 'N/A'}`);
      console.log(`ETH Price: $${tvlResponse.data.ethUsdPrice}`);
      
      // We can use this ethUsdPrice value for our fallback mechanism
      const ethUsdPrice = tvlResponse.data.ethUsdPrice || 1500;
      console.log(`Using ETH price of $${ethUsdPrice} for calculations\n`);
    }
  } catch (error) {
    console.error('Error testing TVL endpoint:', error);
  }
  
  // Test each user
  for (const user of testUsers) {
    console.log(`\n------- Testing user: ${user.description} (${user.address}) -------`);
    const userDataUrl = `${AAVE_API_BASE_URL}/user/${user.chainId}/${user.address}`;
    
    try {
      console.log(`User data endpoint: ${userDataUrl}`);
      const userDataResponse = await makeHttpsRequest(userDataUrl);
      
      if (userDataResponse.status === 200) {
        if (typeof userDataResponse.data === 'object') {
          // Successfully got JSON data
          console.log('✅ Received valid JSON response');
          console.log('User summary available:', !!userDataResponse.data.userSummary);
          
          if (userDataResponse.data.userReservesData) {
            console.log(`User has ${userDataResponse.data.userReservesData.length} reserves`);
            
            // Find reserves with borrow positions
            const borrowPositions = userDataResponse.data.userReservesData.filter(reserve => 
              parseFloat(reserve.principalStableDebt || '0') > 0 || 
              parseFloat(reserve.scaledVariableDebt || '0') > 0
            );
            
            console.log(`User has ${borrowPositions.length} borrow positions`);
            
            if (borrowPositions.length > 0) {
              const firstBorrowPosition = borrowPositions[0];
              console.log('\nSample borrow position:');
              console.log('- Reserve address:', firstBorrowPosition.underlyingAsset);
              console.log('- Principal stable debt:', firstBorrowPosition.principalStableDebt);
              console.log('- Total borrows:', firstBorrowPosition.totalBorrows || 'N/A');
              console.log('- Total borrows in ETH:', firstBorrowPosition.totalBorrowsETH || 'N/A');
              console.log('- Total borrows in USD:', firstBorrowPosition.totalBorrowsUSD || 'N/A');
              
              // This is the kind of data we need to manually construct for our UserPosition interface
              console.log('\nUserPosition mock would look like:');
              console.log({
                principalStableDebt: firstBorrowPosition.principalStableDebt || '0',
                totalBorrows: firstBorrowPosition.totalBorrows || firstBorrowPosition.principalStableDebt || '0',
                totalBorrowsETH: firstBorrowPosition.totalBorrowsETH || '0',
                totalBorrowsUSD: firstBorrowPosition.totalBorrowsUSD || '0',
                reserve: {
                  id: firstBorrowPosition.underlyingAsset,
                  symbol: firstBorrowPosition.symbol || 'Unknown',
                  name: 'Unknown Token',
                  decimals: 18,
                  underlyingAsset: firstBorrowPosition.underlyingAsset
                },
                user: {
                  id: user.address,
                  borrowedReservesCount: borrowPositions.length
                },
                id: `${user.address}${firstBorrowPosition.underlyingAsset}pool`,
                updatedAt: new Date().toISOString()
              });
            }
          }
        } else {
          console.log('❌ Response is not valid JSON (received HTML/Swagger UI)');
          
          // Create a mock UserPosition since we didn't get valid data
          console.log('\nFallback UserPosition mock would look like:');
          console.log({
            principalStableDebt: '741.799829909637470564',
            totalBorrows: '745.234443273648762603',
            totalBorrowsETH: '0.634418081558857191',
            totalBorrowsUSD: '1112.8369088369',
            reserve: {
              id: '0x6b175474e89094c44da98b954eedeac495271d0f',
              symbol: 'DAI',
              name: 'Dai Stablecoin',
              decimals: 18,
              underlyingAsset: '0x6b175474e89094c44da98b954eedeac495271d0f'
            },
            user: {
              id: user.address,
              borrowedReservesCount: 1
            },
            id: `${user.address}0x6b175474e89094c44da98b954eedeac495271d0fpool`,
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        console.log(`❌ User Data API call failed with status: ${userDataResponse.status}`);
        console.log('Response:', typeof userDataResponse.data === 'string' ? userDataResponse.data.substring(0, 100) + '...' : userDataResponse.data);
      }
    } catch (error) {
      console.error('Error testing User Data endpoint:', error);
    }
  }
  
  // Test the reserves data to see what we can use for fallback
  try {
    const reservesUrl = `${AAVE_API_BASE_URL}/data/reserves-data/1`;
    console.log(`\n------- Testing Reserves Data endpoint -------`);
    console.log(`Endpoint: ${reservesUrl}`);
    const reservesResponse = await makeHttpsRequest(reservesUrl);
    
    if (reservesResponse.status === 200) {
      if (typeof reservesResponse.data === 'object') {
        console.log('✅ Reserves Data API call successful (JSON)');
        const reserves = reservesResponse.data.reserves;
        if (reserves && reserves.length > 0) {
          console.log(`Found ${reserves.length} reserves`);
          console.log('\nSample reserve data:');
          console.log('- Symbol:', reserves[0].symbol);
          console.log('- Name:', reserves[0].name);
          console.log('- Decimals:', reserves[0].decimals);
          console.log('- Underlying asset:', reserves[0].underlyingAsset);
        }
      } else {
        console.log('❌ Response is not valid JSON (received HTML/Swagger UI)');
        
        // Show fallback reserve data
        console.log('\nFallback Reserve mock would look like:');
        console.log({
          id: '0x6b175474e89094c44da98b954eedeac495271d0f',
          symbol: 'DAI',
          name: 'Dai Stablecoin',
          decimals: 18,
          underlyingAsset: '0x6b175474e89094c44da98b954eedeac495271d0f'
        });
      }
    } else {
      console.log(`❌ Reserves Data API call failed with status: ${reservesResponse.status}`);
    }
  } catch (error) {
    console.error('Error testing Reserves Data endpoint:', error);
  }
}

// Run the tests
testAaveUserData();
