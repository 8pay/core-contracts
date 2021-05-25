const VariableRecurringPlans = artifacts.require('VariableRecurringPlans');
const VariableRecurringPlansDatabase = artifacts.require('VariableRecurringPlansDatabase');
const VariableRecurringSubscriptions = artifacts.require('VariableRecurringSubscriptions');
const VariableRecurringSubscriptionsDatabase = artifacts.require('VariableRecurringSubscriptionsDatabase');
const MockToken = artifacts.require('MockToken');
const TokensRegistry = artifacts.require('TokensRegistry');
const Transfers = artifacts.require('Transfers');
const FeeProviderMock = artifacts.require('FeeProviderMock');
const { expect } = require('chai');
const expectEvent = require('../../helpers/expect-event');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const Permission = require('../../helpers/permissions');
const Role = require('../../../data/roles');

contract('VariableRecurringSubscriptions', accounts => {
  const [owner, planAdmin, receiver, subscriber, operator, feeCollector, random] = accounts;
  const planAmount = new BN(4000);
  const period = time.duration.days(30);
  const invalidPlanId = web3.utils.padRight('0x12', 64);
  const invalidSubscriptionId = web3.utils.padRight('0x12', 64);

  beforeEach(async () => {
    this.token = await MockToken.new();
    this.tokensRegistry = await TokensRegistry.new([this.token.address]);
    this.feeProvider = await FeeProviderMock.new('0');
    this.transfers = await Transfers.new();
    this.plansDb = await VariableRecurringPlansDatabase.new();
    this.subscriptionsDb = await VariableRecurringSubscriptionsDatabase.new();
    this.plans = await VariableRecurringPlans.new();
    this.subscriptions = await VariableRecurringSubscriptions.new();

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
      'variable',
      planAmount,
      this.token.address,
      period,
      receiver,
      'transport',
      { from: planAdmin }
    );

    this.planId = result.logs[0].args.id;

    await this.plans.grantPermission(this.planId, Permission.TERMINATE, [operator], { from: planAdmin });
    await this.plans.grantPermission(this.planId, Permission.BILL, [operator], { from: planAdmin });
  });

  it('should subscribe', async () => {
    const result = await this.subscriptions.subscribe(this.planId, { from: subscriber });
    const subscriptionId = result.receipt.logs[0].args.subscriptionId;

    expectEvent(result, 'Subscription', { planId: this.planId, subscriptionId: subscriptionId, account: subscriber });

    const isSubscribed = await this.subscriptions.isSubscribed(this.planId, subscriber);
    expect(isSubscribed).to.be.equal(true);
  });

  it('reverts when subscribing to non-existent plan', async () => {
    await expectRevert(
      this.subscriptions.subscribe(invalidPlanId, { from: subscriber }),
      'VRS: invalid plan id'
    );
  });

  it('reverts when getting a non-existent subscription', async () => {
    await expectRevert(
      this.subscriptions.getSubscription(invalidSubscriptionId),
      'VRS: invalid subscription id'
    );
  });

  it('reverts when getting subscription id if not subscribed', async () => {
    await expectRevert(
      this.subscriptions.getSubscriptionId(this.planId, subscriber),
      'VRS: user is not subscribed'
    );
  });

  describe('after subscription', () => {
    beforeEach(async () => {
      const result = await this.subscriptions.subscribe(this.planId, { from: subscriber });
      this.subscriptionId = result.receipt.logs[0].args.subscriptionId;
      this.subscriptionTimestamp = new BN((await web3.eth.getBlock(result.receipt.blockNumber)).timestamp);
    });

    it('reverts when subscribing again', async () => {
      await expectRevert(
        this.subscriptions.subscribe(this.planId, { from: subscriber }),
        'VRS: user is already subscribed'
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

    it('should request cancellation', async () => {
      const result = await this.subscriptions.requestCancellation(this.subscriptionId, { from: subscriber });
      const cancellationRequestTimestamp = new BN((await web3.eth.getBlock(result.receipt.blockNumber)).timestamp);
      const subscription = await this.subscriptions.getSubscription(this.subscriptionId);
      expectEvent(result, 'SubscriptionCancellationRequested', { planId: this.planId, subscriptionId: this.subscriptionId });
      expect(subscription.cancellationRequest).to.be.bignumber.equal(cancellationRequestTimestamp);
    });

    it('reverts when requesting cancellation from another address', async () => {
      await expectRevert(
        this.subscriptions.requestCancellation(this.subscriptionId, { from: random }),
        'VRS: caller is not the subscriber'
      );
    });

    describe('after cancellation request', () => {
      beforeEach(async () => {
        await this.subscriptions.requestCancellation(this.subscriptionId, { from: subscriber });
      });

      it('reverts when requesting cancellation again', async () => {
        await expectRevert(
          this.subscriptions.requestCancellation(this.subscriptionId, { from: subscriber }),
          'VRS: cancellation already requested'
        );
      });
    });
  });
});
