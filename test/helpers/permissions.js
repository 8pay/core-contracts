const web3 = require('web3');

module.exports = {
  BILL: web3.utils.sha3('PERMISSION_BILL'),
  TERMINATE: web3.utils.sha3('PERMISSION_TERMINATE')
};
