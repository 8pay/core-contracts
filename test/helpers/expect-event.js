const _ = require('lodash');
const truffleAssert = require('truffle-assertions');
const { BN, expectEvent } = require('@openzeppelin/test-helpers');

module.exports = (receipt, event, expectedParameters) => {
  truffleAssert.eventEmitted(receipt, event, actualParameters => {
    if (!expectedParameters) {
      return true;
    };

    const expectedParams = _.cloneDeep(expectedParameters);
    const actualParams = _.pickBy(_.cloneDeep(actualParameters), (value, key) => key in expectedParams);

    for (const key in actualParams) {
      if (BN.isBN(actualParams[key])) {
        actualParams[key] = actualParams[key].toString();
      } else if (Array.isArray(actualParams[key]) && BN.isBN(actualParams[key][0])) {
        actualParams[key] = actualParams[key].map(e => e.toString());
      }
    }

    for (const key in expectedParams) {
      if (Number.isInteger(expectedParams[key]) || BN.isBN(expectedParams[key])) {
        expectedParams[key] = expectedParams[key].toString();
      } else if (
        Array.isArray(expectedParams[key]) &&
        (Number.isInteger(expectedParams[key][0]) || BN.isBN(expectedParams[key][0]))
      ) {
        expectedParams[key] = expectedParams[key].map(e => e.toString());
      }
    }

    return _.isEqual(actualParams, expectedParams);
  });
};

module.exports.notEmitted = expectEvent.notEmitted;
