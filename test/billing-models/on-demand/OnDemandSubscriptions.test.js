const OnDemandPlans = artifacts.require('OnDemandPlans');
const OnDemandPlansDatabase = artifacts.require('OnDemandPlansDatabase');
const OnDemandSubscriptions = artifacts.require('OnDemandSubscriptions');
const OnDemandSubscriptionsDatabase = artifacts.require('OnDemandSubscriptionsDatabase');
const Transfers = artifacts.require('Transfers');
const FeeProviderMock = artifacts.require('FeeProviderMock');
const MockToken = artifacts.require('MockToken');
const TokensRegistry = artifacts.require('TokensRegistry');
const { expect } = require('chai');
const expectEvent = require('../../helpers/expect-event');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const Permission = require('../../helpers/permissions');
const Role = require('../../../data/roles');

contract('OnDemandSubscriptions', accounts => {
  const [owner, planAdmin, share, subscriber, operator, feeCollector, random] = accounts;
  const name = 'on demand';
  const period = time.duration.days(30);
  const receivers = [planAdmin, share];
  const percentages = ['9000', '1000'];
  const category = 'transport';
  const minAllowance = new BN(1000);
  const allowance = new BN(4000);
  const invalidPlanId = web3.utils.padRight('0x12', 64);
  const invalidSubscriptionId = web3.utils.padRight('0x12', 64);

  beforeEach(async () => {
    this.token = await MockToken.new();
    this.tokensRegistry = await TokensRegistry.new([this.token.address]);
    this.feeProvider = await FeeProviderMock.new('0');
    this.transfers = await Transfers.new();
    this.plansDb = await OnDemandPlansDatabase.new();
    this.subscriptionsDb = await OnDemandSubscriptionsDatabase.new();
    this.plans = await OnDemandPlans.new();
    this.subscriptions = await OnDemandSubscriptions.new();

    await this.transfers.initialize(this.tokensRegistry.address, this.feeProvider.address, feeCollector);
    await this.plans.initialize(this.plansDb.address, this.tokensRegistry.address);
    await this.subscriptions.initialize(
      this.plansDb.address,
      this.subscriptionsDb.address
    );

    await this.transfers.initAccessControl(
      [Role.OWNER, Role.NETWORK_CONTRACT],
      [owner, this.subscriptions.address]
    );
    await this.plansDb.initAccessControl(
      [Role.OWNER, Role.NETWORK_CONTRACT],
      [owner, this.plans.address]
    );
    await this.subscriptionsDb.initAccessControl(
      [Role.OWNER, Role.NETWORK_CONTRACT],
      [owner, this.subscriptions.address]
    );
  });

  beforeEach(async () => {
    const result = await this.plans.createPlan(
      name,
      minAllowance,
      this.token.address,
      period,
      category,
      receivers,
      percentages,
      { from: planAdmin }
    );

    this.planId = result.logs[0].args.id;

    await this.plans.grantPermission(this.planId, Permission.TERMINATE, [operator], { from: planAdmin });
    await this.plans.grantPermission(this.planId, Permission.BILL, [operator], { from: planAdmin });
  });

  it('should subscribe', async () => {
    const result = await this.subscriptions.subscribe(this.planId, allowance, { from: subscriber });
    const subscriptionId = result.receipt.logs[0].args.subscriptionId;

    expectEvent(result, 'Subscription', { planId: this.planId, subscriptionId: subscriptionId, account: subscriber });
    expectEvent(result, 'AllowanceUpdated', { planId: this.planId, subscriptionId: subscriptionId, allowance: allowance });

    const isSubscribed = await this.subscriptions.isSubscribed(this.planId, subscriber);
    expect(isSubscribed).to.be.equal(true);

    await this.subscriptions.cancel(subscriptionId, { from: subscriber });
  });

  it('reverts when subscribing with an allowance below the min allowance', async () => {
    const invalidAllowance = new BN(1);

    await expectRevert(
      this.subscriptions.subscribe(this.planId, invalidAllowance, { from: subscriber }),
      'ODS: insufficient allowance'
    );
  });

  it('reverts when subscribing to non-existent plans', async () => {
    await expectRevert(
      this.subscriptions.subscribe(invalidPlanId, allowance, { from: subscriber }),
      'ODS: invalid plan id'
    );
  });

  it('reverts when getting a non-existent subscription', async () => {
    await expectRevert(
      this.subscriptions.getSubscription(invalidSubscriptionId),
      'ODS: invalid subscription id'
    );
  });

  it('reverts when getting subscription id if not subscribed', async () => {
    await expectRevert(
      this.subscriptions.getSubscriptionId(this.planId, subscriber),
      'ODS: user is not subscribed'
    );
  });

  describe('after subscription', () => {
    beforeEach(async () => {
      const result = await this.subscriptions.subscribe(this.planId, allowance, { from: subscriber });
      this.subscriptionId = result.receipt.logs[0].args.subscriptionId;
      this.subscriptionTimestamp = new BN((await web3.eth.getBlock(result.receipt.blockNumber)).timestamp);
    });

    it('reverts when subscribing again', async () => {
      await expectRevert(
        this.subscriptions.subscribe(this.planId, allowance, { from: subscriber }),
        'ODS: user is already subscribed'
      );
    });

    it('should get the subscription id', async () => {
      const subscriptionId = await this.subscriptions.getSubscriptionId(this.planId, subscriber);
      expect(subscriptionId).to.be.equal(this.subscriptionId);
    });

    it('should get subscription details', async () => {
      const subscription = await this.subscriptions.getSubscription(this.subscriptionId);
      expect(subscription.account).to.be.equal(subscriber);
      expect(subscription.planId).to.be.equal(this.planId);
      expect(subscription.subscribedAt).to.be.bignumber.equal(this.subscriptionTimestamp);
      expect(subscription.spent).to.be.bignumber.equal('0');
      expect(subscription.allowance).to.be.bignumber.equal(allowance);
      expect(subscription.latestBilling).to.be.bignumber.equal('0');
      expect(subscription.cycleStart).to.be.bignumber.equal(this.subscriptionTimestamp);
      expect(subscription.cycleEnd).to.be.bignumber.equal(this.subscriptionTimestamp.add(period).sub(new BN(1)));
    });

    it('should change allowance', async () => {
      const newAllowance = new BN(5000);
      const result = await this.subscriptions.changeAllowance(this.subscriptionId, newAllowance, { from: subscriber });
      const subscription = await this.subscriptions.getSubscription(this.subscriptionId);
      expectEvent(result, 'AllowanceUpdated', { planId: this.planId, subscriptionId: this.subscriptionId, allowance: newAllowance });
      expect(subscription.allowance).to.be.bignumber.equal(newAllowance);
    });

    it('reverts when changing the allowance to one below the min allowance', async () => {
      const newAllowance = new BN(1);

      await expectRevert(
        this.subscriptions.changeAllowance(this.subscriptionId, newAllowance, { from: subscriber }),
        'ODS: insufficient allowance'
      );
    });

    it('reverts when changing allowance from another address', async () => {
      const newAllowance = new BN(5000);
      await expectRevert(
        this.subscriptions.changeAllowance(this.subscriptionId, newAllowance, { from: random }),
        'ODS: caller is not the subscriber'
      );
    });

    it('should cancel the susbcription', async () => {
      const result = await this.subscriptions.cancel(this.subscriptionId, { from: subscriber });
      const isSubscribed = await this.subscriptions.isSubscribed(this.planId, subscriber);
      expectEvent(result, 'SubscriptionCancelled', { planId: this.planId, subscriptionId: this.subscriptionId });
      expect(isSubscribed).to.be.equal(false);
    });

    it('reverts when cancelling the subscription from another address', async () => {
      await expectRevert(
        this.subscriptions.cancel(this.subscriptionId, { from: random }),
        'ODS: caller is not the subscriber'
      );
    });
  });
});
