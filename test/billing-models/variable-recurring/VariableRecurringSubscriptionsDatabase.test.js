const VariableRecurringSubscriptionsDatabase = artifacts.require('VariableRecurringSubscriptionsDatabase');
const { expect } = require('chai');
const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const Role = require('../../../data/roles');

contract('VariableRecurringSubscriptionsDatabase', accounts => {
  const [owner, authorized, subscriber, random] = accounts;
  const planId = web3.utils.padRight('0x1', 64);
  const subscriptionId = web3.utils.padRight('0x2', 64);
  const subscribedAt = new BN(100);
  const cycleStart = new BN(200);
  const cancellationRequest = new BN(100);

  beforeEach(async () => {
    this.database = await VariableRecurringSubscriptionsDatabase.new({ from: owner });
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

  it('should set cycleStart and get value', async () => {
    await this.database.setCycleStart(subscriptionId, cycleStart, { from: authorized });
    const value = await this.database.getCycleStart(subscriptionId);
    expect(value).to.be.bignumber.equal(cycleStart);
  });

  it('reverts when setting cycleStart from non-authorized', async () => {
    await expectRevert(
      this.database.setCycleStart(subscriptionId, cycleStart, { from: random }),
      'AccessControl: permission denied'
    );
  });

  it('should set cancellationRequest and get value', async () => {
    await this.database.setCancellationRequest(subscriptionId, cancellationRequest, { from: authorized });
    const value = await this.database.getCancellationRequest(subscriptionId);
    expect(value).to.be.bignumber.equal(cancellationRequest);
  });

  it('reverts when setting cancellationRequest from non-authorized', async () => {
    await expectRevert(
      this.database.setCancellationRequest(subscriptionId, cancellationRequest, { from: random }),
      'AccessControl: permission denied'
    );
  });
});
