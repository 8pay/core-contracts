const PaymentType = require('./payment-types');

module.exports = {
  [PaymentType.ONE_TIME]: 100,
  [PaymentType.FIXED_RECURRING]: 100,
  [PaymentType.VARIABLE_RECURRING]: 100,
  [PaymentType.ON_DEMAND]: 100
};
