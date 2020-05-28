const VariableRecurringPlans = artifacts.require('VariableRecurringPlans');
const VariableRecurringPlansDatabase = artifacts.require('VariableRecurringPlansDatabase');
const VariableRecurringSubscriptions = artifacts.require('VariableRecurringSubscriptions');
const VariableRecurringSubscriptionsDatabase = artifacts.require('VariableRecurringSubscriptionsDatabase');
const VariableRecurringSubscriptionsManagement = artifacts.require('VariableRecurringSubscriptionsManagement');
const MockToken = artifacts.require('MockToken');
const TokensRegistry = artifacts.require('TokensRegistry');
const Transfers = artifacts.require('Transfers');
const FeeProviderMock = artifacts.require('FeeProviderMock');
const { expect } = require('chai');
const expectEvent = require('../../helpers/expect-event');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const Permission = require('../../helpers/permissions');
const Role = require('../../../data/roles');

contract('VariableRecurringSubscriptionsManagement', accounts => {
  const [owner, planAdmin, share, subscriber1, subscriber2, operator, feeCollector, random] = accounts;
  const planAmount = new BN(4000);
  const period = time.duration.days(30);
  const receivers = [planAdmin, share];
  const percentages = ['9000', '1000'];
  const billingAmount = new BN(2000);
  const receiversAmounts = percentages.map(e => billingAmount.mul(new BN(e)).div(new BN('10000')));
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
    this.subscriptionsManagement = await VariableRecurringSubscriptionsManagement.new();

    await this.transfers.initialize(this.tokensRegistry.address, this.feeProvider.address, feeCollector);
    await this.plans.initialize(this.plansDb.address, this.tokensRegistry.address);
    await this.subscriptions.initialize(
      this.plansDb.address,
      this.subscriptionsDb.address
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
      'variable',
      planAmount,
      this.token.address,
      period,
      'transport',
      receivers,
      percentages,
      { from: planAdmin }
    );

    this.planId = result.logs[0].args.id;

    await this.plans.grantPermission(this.planId, Permission.TERMINATE, [operator], { from: planAdmin });
    await this.plans.grantPermission(this.planId, Permission.BILL, [operator], { from: planAdmin });
  });

  describe('when subscribed', () => {
    beforeEach(async () => {
      const result = await this.subscriptions.subscribe(this.planId, { from: subscriber1 });
      this.subscriptionId = result.receipt.logs[0].args.subscriptionId;
      this.subscriptionTimestamp = (await web3.eth.getBlock(result.receipt.blockNumber)).timestamp;
    });

    it('reverts when billing before expiry', async () => {
      await expectRevert(
        this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin }),
        'VRSM: no billable subscriptions'
      );
    });

    it('should bill from admin account', async () => {
      await time.increase(period.add(new BN(1)));
      await this.token.transfer(subscriber1, billingAmount);
      await this.token.approve(this.transfers.address, billingAmount, { from: subscriber1 });

      const subscriber1InitialBalance = await this.token.balanceOf(subscriber1);
      const receiversInitialBalance = [];

      for (let i = 0; i < receivers.length; i++) {
        receiversInitialBalance[i] = await this.token.balanceOf(receivers[i]);
      }

      const initialSubscription = await this.subscriptions.getSubscription(this.subscriptionId);
      const result = await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin });
      const finalSubscription = await this.subscriptions.getSubscription(this.subscriptionId);
      const cycleStart = initialSubscription.cycleStart;
      const cycleEnd = initialSubscription.cycleEnd;
      const nextCycleStart = initialSubscription.cycleEnd.add(new BN(1));
      const nextCycleEnd = initialSubscription.cycleEnd.add(new BN(period));

      expectEvent(result, 'Billing', {
        planId: this.planId,
        subscriptionId: this.subscriptionId,
        cycleStart: cycleStart,
        cycleEnd: cycleEnd
      });

      expect(finalSubscription.cycleStart).to.be.bignumber.equal(nextCycleStart);
      expect(finalSubscription.cycleEnd).to.be.bignumber.equal(nextCycleEnd);

      const subscriber1FinalBalance = await this.token.balanceOf(subscriber1);

      expect(subscriber1FinalBalance).to.be.bignumber.equal(subscriber1InitialBalance.sub(billingAmount));

      for (let i = 0; i < receivers.length; i++) {
        const finalBalance = await this.token.balanceOf(receivers[i]);
        expect(finalBalance).to.be.bignumber.equal(receiversInitialBalance[i].add(receiversAmounts[i]));
      }
    });

    it('should bill from operator account', async () => {
      await time.increase(period.add(new BN(1)));
      await this.token.transfer(subscriber1, billingAmount);
      await this.token.approve(this.transfers.address, billingAmount, { from: subscriber1 });
      const initialBalance = await this.token.balanceOf(subscriber1);
      await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: operator });
      const finalBalance = await this.token.balanceOf(subscriber1);
      expect(finalBalance).to.be.bignumber.equal(initialBalance.sub(billingAmount));
    });

    it('reverts when billing from non-allowed account', async () => {
      await expectRevert(
        this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: random }),
        'VRSM: caller is missing permission'
      );
    });

    it('reverts when billing with incorrect parameters', async () => {
      await expectRevert(
        this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [], { from: operator }),
        'VRSM: parameters length mismatch'
      );
    });

    it('should fail billing due to insufficient funds', async () => {
      await time.increase(period.add(new BN(1)));
      const initialBalance = await this.token.balanceOf(subscriber1);
      const result = await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin });
      const finalBalance = await this.token.balanceOf(subscriber1);
      expectEvent(result, 'BillingFailed', { planId: this.planId, subscriptionId: this.subscriptionId });
      expect(finalBalance).to.be.bignumber.equal(initialBalance);
    });

    it('reverts when billing an amount higher than max amount', async () => {
      const amount = planAmount.add(new BN(1));
      await time.increase(period.add(new BN(1)));
      await this.token.transfer(subscriber1, amount);
      await this.token.approve(this.transfers.address, amount, { from: subscriber1 });
      await expectRevert(
        this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [amount], { from: planAdmin }),
        'VRSM: no billable subscriptions'
      );
    });

    it('should terminate the subscription from admin', async () => {
      await this.subscriptionsManagement.terminate(this.planId, [this.subscriptionId], { from: planAdmin });
      const isSubscribed = await this.subscriptions.isSubscribed(this.planId, subscriber1);
      expect(isSubscribed).to.be.equal(false);
    });

    it('should terminate the subscription from operator account', async () => {
      await this.subscriptionsManagement.terminate(this.planId, [this.subscriptionId], { from: operator });
      const isSubscribed = await this.subscriptions.isSubscribed(this.planId, subscriber1);
      expect(isSubscribed).to.be.equal(false);
    });

    it('reverts when terminating a subscription from non-operator account', async () => {
      await expectRevert(
        this.subscriptionsManagement.terminate(this.planId, [this.subscriptionId], { from: random }),
        'VRSM: caller is missing permission'
      );
    });

    describe('after billing failed', () => {
      beforeEach(async () => {
        await time.increase(period.add(new BN(1)));
        await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin });
      });

      it('should successfully bill on retry', async () => {
        await this.token.transfer(subscriber1, billingAmount);
        await this.token.approve(this.transfers.address, billingAmount, { from: subscriber1 });

        const subscriber1InitialBalance = await this.token.balanceOf(subscriber1);
        const initialSubscription = await this.subscriptions.getSubscription(this.subscriptionId);
        await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin });
        const subscriber1FinalBalance = await this.token.balanceOf(subscriber1);
        const finalSubscription = await this.subscriptions.getSubscription(this.subscriptionId);

        expect(finalSubscription.cycleStart).to.be.bignumber.equal(initialSubscription.cycleEnd.add(new BN(1)));
        expect(subscriber1FinalBalance).to.be.bignumber.equal(subscriber1InitialBalance.sub(billingAmount));
      });
    });

    describe('after cancellation request', () => {
      beforeEach(async () => {
        await this.subscriptions.requestCancellation(this.subscriptionId, { from: subscriber1 });
      });

      it('should bill and cancel the subscription', async () => {
        await time.increase(period.add(new BN(1)));
        await this.token.transfer(subscriber1, billingAmount);
        await this.token.approve(this.transfers.address, billingAmount, { from: subscriber1 });

        const initialBalance = await this.token.balanceOf(subscriber1);
        const result = await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin });
        const finalBalance = await this.token.balanceOf(subscriber1);
        const isSubscribed = await this.subscriptions.isSubscribed(this.planId, subscriber1);

        expectEvent(result, 'SubscriptionCancelled', { planId: this.planId, subscriptionId: this.subscriptionId });

        expect(isSubscribed).to.be.equal(false);
        expect(finalBalance).to.be.bignumber.equal(initialBalance.sub(billingAmount));
      });
    });

    describe('after cancelling the subscription', () => {
      beforeEach(async () => {
        await this.subscriptionsManagement.terminate(this.planId, [this.subscriptionId], { from: planAdmin });
      });

      it('reverts when billing an unsubscribed user', async () => {
        await time.increase(period.add(new BN(1)));
        await expectRevert(
          this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin }),
          'VRSM: no billable subscriptions'
        );
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
      await this.token.transfer(subscriber1, billingAmount);
      await this.token.approve(this.transfers.address, billingAmount, { from: subscriber1 });
      await this.token.transfer(subscriber2, billingAmount);
      await this.token.approve(this.transfers.address, billingAmount, { from: subscriber2 });

      const subscriptions = [this.subscriptionId1, this.subscriptionId2];
      const amounts = subscriptions.map(() => billingAmount);

      const initialSubscriber1Balance = await this.token.balanceOf(subscriber1);
      const initialSubscriber2Balance = await this.token.balanceOf(subscriber2);

      await time.increase(period.add(new BN(1)));
      await this.subscriptionsManagement.bill(this.planId, subscriptions, amounts, { from: planAdmin });

      const finalSubscriber1Balance = await this.token.balanceOf(subscriber1);
      const finalSubscriber2Balance = await this.token.balanceOf(subscriber2);

      expect(finalSubscriber1Balance).to.be.bignumber.equal(initialSubscriber1Balance.sub(billingAmount));
      expect(finalSubscriber2Balance).to.be.bignumber.equal(initialSubscriber2Balance.sub(billingAmount));
    });

    it('should filter invalid subscriptions when billing', async () => {
      await this.token.transfer(subscriber1, billingAmount);
      await this.token.approve(this.transfers.address, billingAmount, { from: subscriber1 });
      await this.token.transfer(subscriber2, billingAmount);
      await this.token.approve(this.transfers.address, billingAmount, { from: subscriber2 });

      const invalidSubscriptionBillingAmount = 1;

      const subscriptions = [this.subscriptionId1, invalidSubscriptionId, this.subscriptionId2];
      const amounts = [billingAmount, invalidSubscriptionBillingAmount, billingAmount];

      const initialSubscriber1Balance = await this.token.balanceOf(subscriber1);
      const initialSubscriber2Balance = await this.token.balanceOf(subscriber2);

      await time.increase(period.add(new BN(1)));
      await this.subscriptionsManagement.bill(this.planId, subscriptions, amounts, { from: planAdmin });

      const finalSubscriber1Balance = await this.token.balanceOf(subscriber1);
      const finalSubscriber2Balance = await this.token.balanceOf(subscriber2);

      expect(finalSubscriber1Balance).to.be.bignumber.equal(initialSubscriber1Balance.sub(billingAmount));
      expect(finalSubscriber2Balance).to.be.bignumber.equal(initialSubscriber2Balance.sub(billingAmount));
    });

    it('reverts when providing a duplicate subscription id to billing function', async () => {
      const subscriptions = [this.subscriptionId1, this.subscriptionId2, this.subscriptionId2];
      const amounts = subscriptions.map(e => billingAmount);

      await expectRevert(
        this.subscriptionsManagement.bill(this.planId, subscriptions, amounts, { from: planAdmin }),
        'VRSM: duplicate subscription ids'
      );
    });
  });
});
