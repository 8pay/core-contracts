const FixedRecurringPlans = artifacts.require('FixedRecurringPlans');
const FixedRecurringPlansDatabase = artifacts.require('FixedRecurringPlansDatabase');
const FixedRecurringSubscriptions = artifacts.require('FixedRecurringSubscriptions');
const FixedRecurringSubscriptionsDatabase = artifacts.require('FixedRecurringSubscriptionsDatabase');
const MockToken = artifacts.require('MockToken');
const TokensRegistry = artifacts.require('TokensRegistry');
const Transfers = artifacts.require('Transfers');
const FeeProviderMock = artifacts.require('FeeProviderMock');
const { expect } = require('chai');
const expectEvent = require('../../helpers/expect-event');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const Permission = require('../../helpers/permissions');
const Role = require('../../../data/roles');

contract('FixedRecurringSubscriptions', accounts => {
  const [owner, planAdmin, share, subscriber, operator, feeCollector, random] = accounts;
  const planAmount = new BN(4000);
  const period = time.duration.days(30);
  const receivers = [planAdmin, share];
  const amounts = [new BN('3200'), new BN('800')];
  const invalidPlanId = web3.utils.padRight('0x12', 64);
  const invalidSubscriptionId = web3.utils.padRight('0x12', 64);

  beforeEach(async () => {
    this.token = await MockToken.new();
    this.tokensRegistry = await TokensRegistry.new([this.token.address]);
    this.feeProvider = await FeeProviderMock.new('0');
    this.transfers = await Transfers.new();
    this.plansDb = await FixedRecurringPlansDatabase.new();
    this.subscriptionsDb = await FixedRecurringSubscriptionsDatabase.new();
    this.plans = await FixedRecurringPlans.new();
    this.subscriptions = await FixedRecurringSubscriptions.new();

    await this.transfers.initialize(this.tokensRegistry.address, this.feeProvider.address, feeCollector);
    await this.plans.initialize(this.plansDb.address, this.tokensRegistry.address);
    await this.subscriptions.initialize(
      this.plansDb.address,
      this.subscriptionsDb.address,
      this.transfers.address
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
      'fixed',
      this.token.address,
      period,
      'transport',
      receivers,
      amounts,
      { from: planAdmin }
    );

    this.planId = result.logs[0].args.id;

    await this.plans.grantPermission(this.planId, Permission.TERMINATE, [operator], { from: planAdmin });
  });

  it('should subscribe and perform the first billing', async () => {
    await this.token.transfer(subscriber, planAmount);
    await this.token.approve(this.transfers.address, planAmount, { from: subscriber });

    const subscriber1InitialBalance = await this.token.balanceOf(subscriber);
    const receiversInitialBalance = [];

    for (let i = 0; i < receivers.length; i++) {
      receiversInitialBalance[i] = await this.token.balanceOf(receivers[i]);
    }

    const result = await this.subscriptions.subscribe(this.planId, { from: subscriber });
    const subscriptionTimestamp = new BN((await web3.eth.getBlock(result.receipt.blockNumber)).timestamp);
    const subscriptionId = result.receipt.logs[0].args.subscriptionId;

    expectEvent(result, 'Subscription', { planId: this.planId, subscriptionId: subscriptionId, account: subscriber });
    expectEvent(result, 'Billing', {
      planId: this.planId,
      subscriptionId: subscriptionId,
      cycleStart: subscriptionTimestamp,
      cycleEnd: subscriptionTimestamp.add(period).sub(new BN(1))
    });

    const isSubscribed = await this.subscriptions.isSubscribed(this.planId, subscriber);
    expect(isSubscribed).to.be.equal(true);

    const subscription = await this.subscriptions.getSubscription(subscriptionId);
    expect(subscription.cycleStart).to.be.bignumber.equal(subscriptionTimestamp);
    expect(subscription.cycleEnd).to.be.bignumber.equal(subscriptionTimestamp.add(period).sub(new BN(1)));

    const subscriber1FinalBalance = await this.token.balanceOf(subscriber);

    expect(subscriber1FinalBalance).to.be.bignumber.equal(subscriber1InitialBalance.sub(planAmount));

    for (let i = 0; i < receivers.length; i++) {
      const finalBalance = await this.token.balanceOf(receivers[i]);
      expect(finalBalance).to.be.bignumber.equal(receiversInitialBalance[i].add(amounts[i]));
    }
  });

  it('reverts when subscribing without enough balance', async () => {
    await expectRevert(
      this.subscriptions.subscribe(this.planId, { from: subscriber }),
      'FRS: transfer failed'
    );
  });

  it('reverts when subscribing to non-existent plan', async () => {
    await expectRevert(
      this.subscriptions.subscribe(invalidPlanId, { from: subscriber }),
      'FRS: invalid plan id'
    );
  });

  it('reverts when getting a non-existent subscription', async () => {
    await expectRevert(
      this.subscriptions.getSubscription(invalidSubscriptionId),
      'FRS: invalid subscription id'
    );
  });

  it('reverts when getting subscription id if not subscribed', async () => {
    await expectRevert(
      this.subscriptions.getSubscriptionId(this.planId, subscriber),
      'FRS: user is not subscribed'
    );
  });

  describe('after subscription', () => {
    beforeEach(async () => {
      await this.token.transfer(subscriber, planAmount);
      await this.token.approve(this.transfers.address, planAmount, { from: subscriber });
      const result = await this.subscriptions.subscribe(this.planId, { from: subscriber });
      this.subscriptionId = result.receipt.logs[0].args.subscriptionId;
      this.subscriptionTimestamp = new BN((await web3.eth.getBlock(result.receipt.blockNumber)).timestamp);
    });

    it('reverts when subscribing again', async () => {
      await this.token.transfer(subscriber, planAmount);
      await this.token.approve(this.transfers.address, planAmount, { from: subscriber });
      await expectRevert(
        this.subscriptions.subscribe(this.planId, { from: subscriber }),
        'FRS: user is already subscribed'
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
      expect(subscription.cycleStart).to.be.bignumber.equal(this.subscriptionTimestamp);
      expect(subscription.cycleEnd).to.be.bignumber.equal(this.subscriptionTimestamp.add(period).sub(new BN(1)));
    });

    it('should cancel the subscription', async () => {
      const result = await this.subscriptions.cancel(this.subscriptionId, { from: subscriber });
      const isSubscribed = await this.subscriptions.isSubscribed(this.planId, subscriber);
      expectEvent(result, 'SubscriptionCancelled', { planId: this.planId, subscriptionId: this.subscriptionId });
      expect(isSubscribed).to.be.equal(false);
    });

    it('reverts when cancelling the subscription from another address', async () => {
      await expectRevert(
        this.subscriptions.cancel(this.subscriptionId, { from: random }),
        'FRS: caller is not the subscriber'
      );
    });
  });
});
