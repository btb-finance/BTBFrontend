const fs = require('fs');
const path = require('path');
const solc = require('solc');

// Path to the contract
const contractPath = path.resolve(__dirname, './tokencode.sol');
const contractSource = fs.readFileSync(contractPath, 'utf8');

// Function to resolve imports
function findImports(importPath) {
  try {
    // Check if the import is from node_modules
    if (importPath.startsWith('@')) {
      // Handle imports from node_modules
      const fullPath = path.join(process.cwd(), 'node_modules', importPath);
      try {
        return { contents: fs.readFileSync(fullPath, 'utf8') };
      } catch (e) {
        console.error(`Error importing from node_modules: ${importPath}`);
        return { error: `File not found: ${importPath}` };
      }
    }
    
    // Handle local imports relative to the contract file
    const contractDir = path.dirname(contractPath);
    const fullPath = path.join(contractDir, importPath);
    return { contents: fs.readFileSync(fullPath, 'utf8') };
  } catch (error) {
    console.error(`Error importing ${importPath}: ${error.message}`);
    return { error: `File not found: ${importPath}` };
  }
}

// Prepare input for solidity compiler
const input = {
  language: 'Solidity',
  sources: {
    'tokencode.sol': {
      content: contractSource
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*']
      }
    },
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};

// Compile the contract
console.log('Compiling contract...');
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

// Check for errors
if (output.errors) {
  output.errors.forEach(error => {
    console.log(error.formattedMessage);
  });
  
  // Only exit on severe errors
  const severeErrors = output.errors.filter(error => error.severity === 'error');
  if (severeErrors.length > 0) {
    console.error('Compilation failed due to errors');
    process.exit(1);
  }
}

// Ensure the compiled directory exists
const compiledDir = path.resolve(__dirname, 'compiled');
if (!fs.existsSync(compiledDir)) {
  fs.mkdirSync(compiledDir, { recursive: true });
}

// Extract contract data
const contractName = 'BTBFinance';
const contract = output.contracts['tokencode.sol'][contractName];

// Save the compiled contract
const compiledPath = path.resolve(compiledDir, `${contractName}.json`);
fs.writeFileSync(
  compiledPath,
  JSON.stringify({
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object
  }, null, 2)
);

console.log(`Contract compiled successfully and saved to ${compiledPath}`);
