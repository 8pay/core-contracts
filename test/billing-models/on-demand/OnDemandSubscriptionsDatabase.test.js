const OnDemandSubscriptionsDatabase = artifacts.require('OnDemandSubscriptionsDatabase');
const { expect } = require('chai');
const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const Role = require('../../../data/roles');

contract('OnDemandSubscriptionsDatabase', accounts => {
  const [owner, authorized, subscriber, random] = accounts;
  const planId = web3.utils.padRight('0x1', 64);
  const subscriptionId = web3.utils.padRight('0x2', 64);
  const subscribedAt = new BN(100);
  const allowance = new BN(500);
  const spent = new BN(100);
  const latestBilling = new BN(100);

  beforeEach(async () => {
    this.database = await OnDemandSubscriptionsDatabase.new({ from: owner });
    await this.database.initAccessControl([Role.OWNER, Role.NETWORK_CONTRACT], [owner, authorized]);
  });

  it('should set subscriptionId and get value', async () => {
    await this.database.setSubscriptionId(planId, subscriber, subscriptionId, { from: authorized });
    const value = await this.database.getSubscriptionId(planId, subscriber);
    expect(value).to.be.equal(subscriptionId);
  });

  it('reverts when setting subscriptionId from non-authorized', async () => {
    await expectRevert(
      this.database.setSubscriptionId(planId, subscriber, subscriptionId, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set account and get value', async () => {
    await this.database.setAccount(subscriptionId, subscriber, { from: authorized });
    const value = await this.database.getAccount(subscriptionId);
    expect(value).to.be.equal(subscriber);
  });

  it('reverts when setting account from non-authorized', async () => {
    await expectRevert(
      this.database.setAccount(subscriptionId, subscriber, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set planId and get value', async () => {
    await this.database.setPlanId(subscriptionId, planId, { from: authorized });
    const value = await this.database.getPlanId(subscriptionId);
    expect(value).to.be.equal(planId);
  });

  it('reverts when setting planId from non-authorized', async () => {
    await expectRevert(
      this.database.setPlanId(subscriptionId, planId, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set subscribedAt and get value', async () => {
    await this.database.setSubscribedAt(subscriptionId, subscribedAt, { from: authorized });
    const value = await this.database.getSubscribedAt(subscriptionId);
    expect(value).to.be.bignumber.equal(subscribedAt);
  });

  it('reverts when setting subscribedAt from non-authorized', async () => {
    await expectRevert(
      this.database.setSubscribedAt(subscriptionId, subscribedAt, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set allowance and get value', async () => {
    await this.database.setAllowance(subscriptionId, allowance, { from: authorized });
    const value = await this.database.getAllowance(subscriptionId);
    expect(value).to.be.bignumber.equal(allowance);
  });

  it('reverts when setting allowance from non-authorized', async () => {
    await expectRevert(
      this.database.setAllowance(subscriptionId, allowance, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set spent and get value', async () => {
    await this.database.setSpent(subscriptionId, spent, { from: authorized });
    const value = await this.database.getSpent(subscriptionId);
    expect(value).to.be.bignumber.equal(spent);
  });

  it('reverts when setting spent from non-authorized', async () => {
    await expectRevert(
      this.database.setSpent(subscriptionId, spent, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set latestBilling and get value', async () => {
    await this.database.setLatestBilling(subscriptionId, latestBilling, { from: authorized });
    const value = await this.database.getLatestBilling(subscriptionId);
    expect(value).to.be.bignumber.equal(latestBilling);
  });

  it('reverts when setting latestBilling from non-authorized', async () => {
    await expectRevert(
      this.database.setLatestBilling(subscriptionId, latestBilling, { from: random }),
      'AccessControl: permission denied'
    );
  });
});
