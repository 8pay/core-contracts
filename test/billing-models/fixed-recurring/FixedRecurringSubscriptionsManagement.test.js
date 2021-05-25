const FixedRecurringPlans = artifacts.require('FixedRecurringPlans');
const FixedRecurringPlansDatabase = artifacts.require('FixedRecurringPlansDatabase');
const FixedRecurringSubscriptions = artifacts.require('FixedRecurringSubscriptions');
const FixedRecurringSubscriptionsDatabase = artifacts.require('FixedRecurringSubscriptionsDatabase');
const FixedRecurringSubscriptionsManagement = artifacts.require('FixedRecurringSubscriptionsManagement');
const MockToken = artifacts.require('MockToken');
const TokensRegistry = artifacts.require('TokensRegistry');
const Transfers = artifacts.require('Transfers');
const FeeProviderMock = artifacts.require('FeeProviderMock');
const { expect } = require('chai');
const expectEvent = require('../../helpers/expect-event');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const Permission = require('../../helpers/permissions');
const Role = require('../../../data/roles');

contract('FixedRecurringSubscriptionsManagement', accounts => {
  const [owner, planAdmin, receiver, subscriber1, subscriber2, operator, feeCollector, random] = accounts;
  const planAmount = new BN(4000);
  const period = time.duration.days(30);
  const amount = new BN('4000');
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
    this.subscriptionsManagement = await FixedRecurringSubscriptionsManagement.new();

    await this.transfers.initialize(this.tokensRegistry.address, this.feeProvider.address, feeCollector);
    await this.plans.initialize(this.plansDb.address, this.tokensRegistry.address);
    await this.subscriptions.initialize(
      this.plansDb.address,
      this.subscriptionsDb.address,
      this.transfers.address
    );
    await this.subscriptionsManagement.initialize(
      this.plansDb.address,
      this.subscriptionsDb.address,
      this.transfers.address
    );

    await this.transfers.initAccessControl(
      [Role.OWNER, Role.NETWORK_CONTRACT, Role.NETWORK_CONTRACT],
      [owner, this.subscriptions.address, this.subscriptionsManagement.address]
    );
    await this.plansDb.initAccessControl(
      [Role.OWNER, Role.NETWORK_CONTRACT],
      [owner, this.plans.address]
    );
    await this.subscriptionsDb.initAccessControl(
      [Role.OWNER, Role.NETWORK_CONTRACT, Role.NETWORK_CONTRACT],
      [owner, this.subscriptions.address, this.subscriptionsManagement.address]
    );
  });

  beforeEach(async () => {
    const result = await this.plans.createPlan(
      'fixed',
      amount,
      this.token.address,
      period,
      receiver,
      'transport',
      { from: planAdmin }
    );

    this.planId = result.logs[0].args.id;

    await this.plans.grantPermission(this.planId, Permission.TERMINATE, [operator], { from: planAdmin });
  });

  describe('when subscribed', () => {
    beforeEach(async () => {
      await this.token.transfer(subscriber1, planAmount);
      await this.token.approve(this.transfers.address, planAmount, { from: subscriber1 });
      const result = await this.subscriptions.subscribe(this.planId, { from: subscriber1 });
      this.subscriptionId = result.receipt.logs[0].args.subscriptionId;
      this.subscriptionTimestamp = (await web3.eth.getBlock(result.receipt.blockNumber)).timestamp;
    });

    it('should not bill before expiry', async () => {
      const result = await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], { from: planAdmin });
      expectEvent.notEmitted(result, 'Billing');
      expectEvent.notEmitted(result, 'BillingFailed');
    });

    it('should bill from admin account', async () => {
      await time.increase(period.add(new BN(1)));
      await this.token.transfer(subscriber1, planAmount);
      await this.token.approve(this.transfers.address, planAmount, { from: subscriber1 });

      const subscriber1InitialBalance = await this.token.balanceOf(subscriber1);
      const receiverInitialBalance = await await this.token.balanceOf(receiver);

      const initialSubscription = await this.subscriptions.getSubscription(this.subscriptionId);
      const result = await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], { from: planAdmin });
      const finalSubscription = await this.subscriptions.getSubscription(this.subscriptionId);
      const cycleStart = initialSubscription.cycleEnd.add(new BN(1));
      const cycleEnd = initialSubscription.cycleEnd.add(new BN(period));

      expectEvent(result, 'Billing', {
        planId: this.planId,
        subscriptionId: this.subscriptionId,
        cycleStart: cycleStart,
        cycleEnd: cycleEnd
      });

      expect(finalSubscription.cycleStart).to.be.bignumber.equal(cycleStart);
      expect(finalSubscription.cycleEnd).to.be.bignumber.equal(cycleEnd);

      const subscriber1FinalBalance = await this.token.balanceOf(subscriber1);

      expect(subscriber1FinalBalance, subscriber1InitialBalance.sub(planAmount));

      const receiverFinalBalance = await this.token.balanceOf(receiver);

      expect(receiverFinalBalance).to.be.bignumber.equal(receiverInitialBalance.add(amount));
    });

    it('should bill from random account', async () => {
      await time.increase(period.add(new BN(1)));
      await this.token.transfer(subscriber1, planAmount);
      await this.token.approve(this.transfers.address, planAmount, { from: subscriber1 });
      const initialBalance = await this.token.balanceOf(subscriber1);
      await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], { from: random });
      const finalBalance = await this.token.balanceOf(subscriber1);
      expect(finalBalance).to.be.bignumber.equal(initialBalance.sub(planAmount));
    });

    it('should fail billing due to insufficient funds', async () => {
      await time.increase(period.add(new BN(1)));
      const initialBalance = await this.token.balanceOf(subscriber1);
      const result = await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], { from: planAdmin });
      const finalBalance = await this.token.balanceOf(subscriber1);
      expectEvent(result, 'BillingFailed', { planId: this.planId, subscriptionId: this.subscriptionId });
      expect(finalBalance).to.be.bignumber.equal(initialBalance);
    });

    it('should terminate the subscription from admin account', async () => {
      const result = await this.subscriptionsManagement.terminate(this.planId, [this.subscriptionId], { from: planAdmin });
      const isSubscribed = await this.subscriptions.isSubscribed(this.planId, subscriber1);
      expectEvent(result, 'SubscriptionTerminated', { planId: this.planId, subscriptionId: this.subscriptionId });
      expect(isSubscribed).to.be.equal(false);
    });

    it('should terminate the subscription', async () => {
      const result = await this.subscriptionsManagement.terminate(this.planId, [this.subscriptionId], { from: operator });
      const isSubscribed = await this.subscriptions.isSubscribed(this.planId, subscriber1);
      expectEvent(result, 'SubscriptionTerminated', { planId: this.planId, subscriptionId: this.subscriptionId });
      expect(isSubscribed).to.be.equal(false);
    });

    it('reverts when terminating the subscription from non-operator', async () => {
      await expectRevert(
        this.subscriptionsManagement.terminate(this.planId, [this.subscriptionId], { from: random }),
        'FRSM: caller is missing permission'
      );
    });

    describe('after canceling the subscription', () => {
      beforeEach(async () => {
        await this.subscriptions.cancel(this.subscriptionId, { from: subscriber1 });
      });

      it('should not bill an unsubscribed user', async () => {
        await time.increase(period.add(new BN(1)));

        const result = await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], { from: planAdmin });
        expectEvent.notEmitted(result, 'Billing');
        expectEvent.notEmitted(result, 'BillingFailed');
      });
    });

    describe('after billing failed', () => {
      beforeEach(async () => {
        await time.increase(period.add(new BN(1)));
        await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], { from: planAdmin });
      });

      it('should successfully bill on retry', async () => {
        await this.token.transfer(subscriber1, planAmount);
        await this.token.approve(this.transfers.address, planAmount, { from: subscriber1 });

        const subscriber1InitialBalance = await this.token.balanceOf(subscriber1);
        const initialSubscription = await this.subscriptions.getSubscription(this.subscriptionId);
        await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], { from: planAdmin });
        const subscriber1FinalBalance = await this.token.balanceOf(subscriber1);
        const finalSubscription = await this.subscriptions.getSubscription(this.subscriptionId);

        expect(finalSubscription.cycleStart).to.be.bignumber.equal(initialSubscription.cycleEnd.add(new BN(1)));
        expect(subscriber1FinalBalance).to.be.bignumber.equal(subscriber1InitialBalance.sub(planAmount));
      });
    });
  });

  describe('with multiple users subscribed', () => {
    beforeEach(async () => {
      await this.token.transfer(subscriber1, planAmount);
      await this.token.approve(this.transfers.address, planAmount, { from: subscriber1 });
      await this.token.transfer(subscriber2, planAmount);
      await this.token.approve(this.transfers.address, planAmount, { from: subscriber2 });

      const result1 = await this.subscriptions.subscribe(this.planId, { from: subscriber1 });
      const result2 = await this.subscriptions.subscribe(this.planId, { from: subscriber2 });

      this.subscriptionId1 = result1.receipt.logs[0].args.subscriptionId;
      this.subscriptionId2 = result2.receipt.logs[0].args.subscriptionId;
    });

    it('should bill multiple users at once', async () => {
      await this.token.transfer(subscriber1, planAmount);
      await this.token.approve(this.transfers.address, planAmount, { from: subscriber1 });
      await this.token.transfer(subscriber2, planAmount);
      await this.token.approve(this.transfers.address, planAmount, { from: subscriber2 });

      const subscriptions = [this.subscriptionId1, this.subscriptionId2];

      const initialSubscriber1Balance = await this.token.balanceOf(subscriber1);
      const initialSubscriber2Balance = await this.token.balanceOf(subscriber2);

      await time.increase(period.add(new BN(1)));
      await this.subscriptionsManagement.bill(this.planId, subscriptions, { from: planAdmin });

      const finalSubscriber1Balance = await this.token.balanceOf(subscriber1);
      const finalSubscriber2Balance = await this.token.balanceOf(subscriber2);

      expect(finalSubscriber1Balance).to.be.bignumber.equal(initialSubscriber1Balance.sub(planAmount));
      expect(finalSubscriber2Balance).to.be.bignumber.equal(initialSubscriber2Balance.sub(planAmount));
    });

    it('should filter invalid subscriptions when billing', async () => {
      await this.token.transfer(subscriber1, planAmount);
      await this.token.approve(this.transfers.address, planAmount, { from: subscriber1 });
      await this.token.transfer(subscriber2, planAmount);
      await this.token.approve(this.transfers.address, planAmount, { from: subscriber2 });

      const subscriptions = [this.subscriptionId1, invalidSubscriptionId, this.subscriptionId2];

      const initialSubscriber1Balance = await this.token.balanceOf(subscriber1);
      const initialSubscriber2Balance = await this.token.balanceOf(subscriber2);

      await time.increase(period.add(new BN(1)));
      await this.subscriptionsManagement.bill(this.planId, subscriptions, { from: planAdmin });

      const finalSubscriber1Balance = await this.token.balanceOf(subscriber1);
      const finalSubscriber2Balance = await this.token.balanceOf(subscriber2);

      expect(finalSubscriber1Balance).to.be.bignumber.equal(initialSubscriber1Balance.sub(planAmount));
      expect(finalSubscriber2Balance).to.be.bignumber.equal(initialSubscriber2Balance.sub(planAmount));
    });
  });
});
