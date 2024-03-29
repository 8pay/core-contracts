const OnDemandPlansDatabase = artifacts.require('OnDemandPlansDatabase');
const { expect } = require('chai');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const Role = require('../../../data/roles');
const Permission = require('../../helpers/permissions');

contract('OnDemandPlansDatabase', accounts => {
  const [owner, authorized, planAdmin, receiver, operator, random] = accounts;
  const planId = web3.utils.padRight('0x12', 64);
  const minAllowance = new BN(4000);
  const token = web3.utils.padRight('0xa', 40);
  const period = time.duration.days(30);

  beforeEach(async () => {
    this.database = await OnDemandPlansDatabase.new({ from: owner });
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

  it('should set min allowance and get value', async () => {
    await this.database.setMinAllowance(planId, minAllowance, { from: authorized });
    const value = await this.database.getMinAllowance(planId);
    expect(value).to.be.bignumber.equal(minAllowance);
  });

  it('reverts when setting min allowance from non-authorized', async () => {
    await expectRevert(
      this.database.setMinAllowance(planId, minAllowance, { from: random }),
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

  it('should set permission and get value', async () => {
    await this.database.setPermission(planId, Permission.BILL, operator, true, { from: authorized });
    const hasPermission = await this.database.hasPermission(planId, Permission.BILL, operator);
    expect(hasPermission).to.be.equal(true);
  });

  it('reverts when setting permission from non-authorized', async () => {
    await expectRevert(
      this.database.setPermission(planId, Permission.BILL, operator, true, { from: random }),
      'AccessControl: permission denied'
    );
  });
});
