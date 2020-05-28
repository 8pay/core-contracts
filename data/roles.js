const web3 = require('web3');

module.exports = {
  OWNER: web3.utils.sha3('OWNER_ROLE'),
  NETWORK_CONTRACT: web3.utils.sha3('NETWORK_CONTRACT_ROLE')
};
