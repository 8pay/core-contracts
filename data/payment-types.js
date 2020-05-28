const web3 = require('web3');

module.exports = {
  ONE_TIME: web3.utils.sha3('ONE_TIME'),
  FIXED_RECURRING: web3.utils.sha3('FIXED_RECURRING'),
  VARIABLE_RECURRING: web3.utils.sha3('VARIABLE_RECURRING'),
  ON_DEMAND: web3.utils.sha3('ON_DEMAND')
};
