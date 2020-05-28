const FixedRecurringPlansDatabase = artifacts.require('FixedRecurringPlansDatabase');
const { expect } = require('chai');
const { expectRevert, time } = require('@openzeppelin/test-helpers');
const Role = require('../../../data/roles');
const Permission = require('../../helpers/permissions');

contract('FixedRecurringPlansDatabase', accounts => {
  const [owner, authorized, planAdmin, receiver1, receiver2, operator, random] = accounts;
  const planId = web3.utils.padRight('0x12', 64);
  const token = web3.utils.padRight('0xa', 40);
  const receivers = [receiver1, receiver2];
  const amounts = ['3200', '800'];
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
      'AccessControl: permission'
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
      'AccessControl: permission'
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
      'AccessControl: permission'
    );
  });

  it('should set receivers and get value', async () => {
    await this.database.setReceivers(planId, receivers, { from: authorized });
    const value = await this.database.getReceivers(planId);
    expect(value).to.be.deep.equal(receivers);
  });

  it('reverts when setting receivers from non-authorized', async () => {
    await expectRevert(
      this.database.setReceivers(planId, receivers, { from: random }),
      'AccessControl: permission'
    );
  });

  it('should set amounts and get value', async () => {
    await this.database.setAmounts(planId, amounts, { from: authorized });
    const value = await this.database.getAmounts(planId);
    expect(value.map(e => e.toString())).to.be.deep.equal(amounts);
  });

  it('reverts when setting amounts from non-authorized', async () => {
    await expectRevert(
      this.database.setAmounts(planId, amounts, { from: random }),
      'AccessControl: permission'
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
      'AccessControl: permission'
    );
  });
});
