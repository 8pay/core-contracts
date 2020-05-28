const ArraysMock = artifacts.require('ArraysMock');
const { expect } = require('chai');

contract('Arrays', () => {
  beforeEach(async () => {
    this.arrays = await ArraysMock.new();
  });

  it('should sum uint256', async () => {
    const array = ['10', '20'];
    const sum = await this.arrays.sumUint256(array);
    expect(sum).to.be.bignumber.equal('30');
  });

  it('should detect duplicates on bytes32', async () => {
    const toBytes = array => array.map(e => web3.utils.padLeft(web3.utils.numberToHex(e.toString()), 64));

    let res = await this.arrays.hasDuplicatesBytes32(toBytes([1]));
    expect(res).to.be.equal(false);
    res = await this.arrays.hasDuplicatesBytes32(toBytes([1, 314, 627]));
    expect(res).to.be.equal(false);
    res = await this.arrays.hasDuplicatesBytes32(toBytes([1, 2]));
    expect(res).to.be.equal(false);
    res = await this.arrays.hasDuplicatesBytes32(toBytes([1, 3, 7, 11, 24, 17, 2]));
    expect(res).to.be.equal(false);
    res = await this.arrays.hasDuplicatesBytes32(toBytes([1, 1]));
    expect(res).to.be.equal(true);
    res = await this.arrays.hasDuplicatesBytes32(toBytes([1, 2, 3, 1]));
    expect(res).to.be.equal(true);
    res = await this.arrays.hasDuplicatesBytes32(toBytes([1, 2, 3, 7, 7]));
    expect(res).to.be.equal(true);
  });
});
