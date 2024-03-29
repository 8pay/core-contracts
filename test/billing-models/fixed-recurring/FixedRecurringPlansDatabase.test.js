const FixedRecurringPlansDatabase = artifacts.require('FixedRecurringPlansDatabase');
const { expect } = require('chai');
const { expectRevert, time } = require('@openzeppelin/test-helpers');
const Role = require('../../../data/roles');
const Permission = require('../../helpers/permissions');

contract('FixedRecurringPlansDatabase', accounts => {
  const [owner, authorized, planAdmin, receiver, operator, random] = accounts;
  const planId = web3.utils.padRight('0x12', 64);
  const token = web3.utils.padRight('0xa', 40);
  const amount = '4000';
  const period = time.duration.days(30);

  beforeEach(async () => {
    this.database = await FixedRecurringPlansDatabase.new({ from: owner });
    await this.database.initAccessControl([Role.OWNER, Role.NETWORK_CONTRACT], [owner, authorized]);
  });

  it('should set admin and get value', async () => {
    await this.database.setAdmin(planId, planAdmin, { from: authorized });
    const value = await this.database.getAdmin(planId);
    expect(value).to.be.equal(planAdmin);
  });

  it('reverts when setting admin from non-authorized', async () => {
    await expectRevert(
      this.database.setAdmin(planId, planAdmin, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set period and get value', async () => {
    await this.database.setPeriod(planId, period, { from: authorized });
    const value = await this.database.getPeriod(planId);
    expect(value).to.be.bignumber.equal(period);
  });

  it('reverts when setting period from non-authorized', async () => {
    await expectRevert(
      this.database.setPeriod(planId, period, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set token and get value', async () => {
    await this.database.setToken(planId, token, { from: authorized });
    const value = await this.database.getToken(planId);
    expect(value).to.be.equal(token);
  });

  it('reverts when setting token from non-authorized', async () => {
    await expectRevert(
      this.database.setToken(planId, token, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set receiver and get value', async () => {
    await this.database.setReceiver(planId, receiver, { from: authorized });
    const value = await this.database.getReceiver(planId);
    expect(value).to.be.equal(receiver);
  });

  it('reverts when setting receiver from non-authorized', async () => {
    await expectRevert(
      this.database.setReceiver(planId, receiver, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set amount and get value', async () => {
    await this.database.setAmount(planId, amount, { from: authorized });
    const value = await this.database.getAmount(planId);
    expect(value).to.be.bignumber.equal(amount);
  });

  it('reverts when setting amount from non-authorized', async () => {
    await expectRevert(
      this.database.setAmount(planId, amount, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set permission and get value', async () => {
    await this.database.setPermission(planId, Permission.TERMINATE, operator, true, { from: authorized });
    const hasPermission = await this.database.hasPermission(planId, Permission.TERMINATE, operator);
    expect(hasPermission).to.be.equal(true);
  });

  it('reverts when setting permission from non-authorized', async () => {
    await expectRevert(
      this.database.setPermission(planId, Permission.TERMINATE, operator, true, { from: random }),
      'AccessControl: permission denied'
    );
  });
});
