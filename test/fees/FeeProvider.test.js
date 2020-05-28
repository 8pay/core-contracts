const FeeProvider = artifacts.require('FeeProvider');
const { expect } = require('chai');
const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const expectEvent = require('../helpers/expect-event');
const Role = require('../../data/roles');
const PaymentType = require('../../data/payment-types');

contract('FeeProvider', accounts => {
  const [owner, user, random] = accounts;
  const BASE_FEE = new BN(100);
  const CUSTOM_FEE = new BN(50);

  beforeEach(async () => {
    this.feeProvider = await FeeProvider.new([PaymentType.ONE_TIME], [BASE_FEE], { from: owner });

    await this.feeProvider.initAccessControl([Role.OWNER], [owner]);
  });

  it('should get initial base fee', async () => {
    const baseFee = await this.feeProvider.getBaseFee(PaymentType.ONE_TIME);
    expect(baseFee).to.be.bignumber.equal(baseFee);
  });

  it('should set base fee', async () => {
    const result = await this.feeProvider.setBaseFee(PaymentType.ONE_TIME, BASE_FEE, { from: owner });
    const value = await this.feeProvider.getBaseFee(PaymentType.ONE_TIME);
    expectEvent(result, 'BaseFeeUpdated', { paymentType: PaymentType.ONE_TIME, fee: BASE_FEE });
    expect(value).to.be.bignumber.equal(BASE_FEE);
  });

  it('reverts when setting base fee from non-owner', async () => {
    await expectRevert(
      this.feeProvider.setBaseFee(PaymentType.ONE_TIME, BASE_FEE, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set custom fee', async () => {
    const result = await this.feeProvider.setCustomFee(user, PaymentType.ONE_TIME, CUSTOM_FEE, { from: owner });
    const value = await this.feeProvider.getCustomFee(user, PaymentType.ONE_TIME);
    expectEvent(result, 'CustomFeeUpdated', { account: user, paymentType: PaymentType.ONE_TIME, fee: CUSTOM_FEE });
    expect(value).to.be.bignumber.equal(CUSTOM_FEE);
  });

  it('reverts when setting custom fee from non-owner', async () => {
    await expectRevert(
      this.feeProvider.setCustomFee(user, PaymentType.ONE_TIME, CUSTOM_FEE, { from: random }),
      'AccessControl: permission denied'
    );
  });

  describe('without custom fee', () => {
    beforeEach(async () => {
      await this.feeProvider.setBaseFee(PaymentType.ONE_TIME, BASE_FEE, { from: owner });
    });

    it('base fee should be applied', async () => {
      const fee = await this.feeProvider.getFee(user, PaymentType.ONE_TIME);
      expect(fee).to.be.bignumber.equal(BASE_FEE);
    });
  });

  describe('with custom fee', () => {
    beforeEach(async () => {
      await this.feeProvider.setBaseFee(PaymentType.ONE_TIME, BASE_FEE, { from: owner });
      await this.feeProvider.setCustomFee(user, PaymentType.ONE_TIME, CUSTOM_FEE, { from: owner });
    });

    it('custom fee should be applied', async () => {
      const fee = await this.feeProvider.getFee(user, PaymentType.ONE_TIME);
      expect(fee).to.be.bignumber.equal(CUSTOM_FEE);
    });
  });
});
