require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-truffle5');
require('@nomiclabs/hardhat-web3');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-deploy');
require('hardhat-abi-exporter');
require('hardhat-contract-sizer');
require('solidity-coverage');
require('dotenv').config();

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: '0.8.4',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    bsc: {
      url: 'https://bsc-dataseed.binance.org/',
      accounts: { mnemonic: process.env.MNEMONIC }
    },
    private: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      accounts: { mnemonic: process.env.MNEMONIC }
    }
  },
  namedAccounts: {
    deployer: 0,
    multiSigWallet: {
      default: 1,
      bsc: '0xab8Fb12848Fb67def3376116Fbfa06eB1A2Dd06e',
      private: '0xf08bce380df0D06C890eb6668D72bE9512F29092'
    },
    feeCollector: {
      default: 2,
      bsc: '0xD8BEC82Dd5C0FE69f012de6660C4a44d63b786BD',
      private: '0xe17C7A6ae970437e36785a77899D234Bc9eB1f39'
    }
  }
};
