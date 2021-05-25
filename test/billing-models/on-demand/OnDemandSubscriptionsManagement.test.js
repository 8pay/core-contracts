const OnDemandPlans = artifacts.require('OnDemandPlans');
const OnDemandPlansDatabase = artifacts.require('OnDemandPlansDatabase');
const OnDemandSubscriptions = artifacts.require('OnDemandSubscriptions');
const OnDemandSubscriptionsDatabase = artifacts.require('OnDemandSubscriptionsDatabase');
const OnDemandSubscriptionsManagement = artifacts.require('OnDemandSubscriptionsManagement');
const Transfers = artifacts.require('Transfers');
const FeeProviderMock = artifacts.require('FeeProviderMock');
const MockToken = artifacts.require('MockToken');
const TokensRegistry = artifacts.require('TokensRegistry');
const { expect } = require('chai');
const expectEvent = require('../../helpers/expect-event');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const Permission = require('../../helpers/permissions');
const Role = require('../../../data/roles');

contract('OnDemandSubscriptionsManagement', accounts => {
  const [owner, planAdmin, receiver, subscriber1, subscriber2, operator, feeCollector, random] = accounts;
  const name = 'on demand';
  const period = time.duration.days(30);
  const category = 'transport';
  const minAllowance = new BN(1000);
  const allowance = new BN(4000);
  const billingAmount = new BN(2000);
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
    this.subscriptionsManagement = await OnDemandSubscriptionsManagement.new();

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
      name,
      minAllowance,
      this.token.address,
      period,
      receiver,
      category,
      { from: planAdmin }
    );

    this.planId = result.logs[0].args.id;

    await this.plans.grantPermission(this.planId, Permission.TERMINATE, [operator], { from: planAdmin });
    await this.plans.grantPermission(this.planId, Permission.BILL, [operator], { from: planAdmin });
  });

  describe('when subscribed', () => {
    beforeEach(async () => {
      const result = await this.subscriptions.subscribe(this.planId, allowance, { from: subscriber1 });
      this.subscriptionId = result.receipt.logs[0].args.subscriptionId;
      this.subscriptionTimestamp = (await web3.eth.getBlock(result.receipt.blockNumber)).timestamp;
    });

    it('should check if billing of an amount below allowance can be performed', async () => {
      const isBillingAllowed = await this.subscriptionsManagement.isBillingAllowed(this.subscriptionId, billingAmount);
      expect(isBillingAllowed).to.be.equal(true);
    });

    it('should check if billing of an amount above allowance can be performed', async () => {
      const amount = allowance.add(new BN(1));
      const isBillingAllowed = await this.subscriptionsManagement.isBillingAllowed(this.subscriptionId, amount);
      expect(isBillingAllowed).to.be.equal(false);
    });

    it('should bill from admin account', async () => {
      await time.increase(period.add(new BN(1)));
      await this.token.transfer(subscriber1, billingAmount);
      await this.token.approve(this.transfers.address, billingAmount, { from: subscriber1 });

      const subscriber1InitialBalance = await this.token.balanceOf(subscriber1);
      const receiverInitialBalance = await this.token.balanceOf(receiver);

      const result = await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin });
      const subscription = await this.subscriptions.getSubscription(this.subscriptionId);
      const billingTimestamp = new BN((await web3.eth.getBlock(result.receipt.blockNumber)).timestamp);

      expectEvent(result, 'Billing', { planId: this.planId, subscriptionId: this.subscriptionId, amount: billingAmount });

      expect(subscription.latestBilling).to.be.bignumber.equal(billingTimestamp);
      expect(subscription.spent).to.be.bignumber.equal(billingAmount);

      const subscriber1FinalBalance = await this.token.balanceOf(subscriber1);

      expect(subscriber1FinalBalance).to.be.bignumber.equal(subscriber1InitialBalance.sub(billingAmount));

      const receiverFinalBalance = await this.token.balanceOf(receiver);

      expect(receiverFinalBalance).to.be.bignumber.equal(receiverInitialBalance.add(billingAmount));
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
        'ODSM: caller is missing permission'
      );
    });

    it('reverts when billing with incorrect parameters', async () => {
      await expectRevert(
        this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [], { from: operator }),
        'ODSM: parameters length mismatch'
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

    it('should terminate the subscription from admin account', async () => {
      const result = await this.subscriptionsManagement.terminate(this.planId, [this.subscriptionId], { from: planAdmin });
      const isSubscribed = await this.subscriptions.isSubscribed(this.planId, subscriber1);
      expectEvent(result, 'SubscriptionTerminated', { planId: this.planId, subscriptionId: this.subscriptionId });
      expect(isSubscribed).to.be.equal(false);
    });

    it('should terminate the subscription from operator account', async () => {
      const result = await this.subscriptionsManagement.terminate(this.planId, [this.subscriptionId], { from: operator });
      const isSubscribed = await this.subscriptions.isSubscribed(this.planId, subscriber1);
      expectEvent(result, 'SubscriptionTerminated', { planId: this.planId, subscriptionId: this.subscriptionId });
      expect(isSubscribed).to.be.equal(false);
    });

    it('reverts when terminating from non-operator', async () => {
      await expectRevert(
        this.subscriptionsManagement.terminate(this.planId, [this.subscriptionId], { from: random }),
        'ODSM: caller is missing permission'
      );
    });

    describe('after billing', () => {
      beforeEach(async () => {
        await this.token.transfer(subscriber1, billingAmount);
        await this.token.approve(this.transfers.address, billingAmount, { from: subscriber1 });
        await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin });
      });

      it('should bill again in the same cycle', async () => {
        await this.token.transfer(subscriber1, billingAmount);
        await this.token.approve(this.transfers.address, billingAmount, { from: subscriber1 });
        const result = await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin });

        expectEvent(result, 'Billing', expectEvent(result, 'Billing', {
          planId: this.planId,
          subscriptionId: this.subscriptionId,
          amount: billingAmount
        }));

        const subscription = await this.subscriptions.getSubscription(this.subscriptionId);
        expect(subscription.spent).to.be.bignumber.equal(billingAmount.mul(new BN(2)));
      });

      it('should not exceed allowance in cycle', async () => {
        const amount = billingAmount.mul(new BN(2));
        const result = await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [amount], { from: planAdmin });
        expectEvent.notEmitted(result, 'Billing');
        expectEvent.notEmitted(result, 'BillingFailed');
      });

      it('should reset spent amount in the next cycle', async () => {
        await time.increase(period.add(new BN(1)));
        const subscriptions = await this.subscriptions.getSubscription(this.subscriptionId);
        expect(subscriptions.spent).to.be.bignumber.equal('0');
      });

      it('should bill again in the next cycle', async () => {
        await time.increase(period.add(new BN(1)));
        await this.token.transfer(subscriber1, billingAmount);
        await this.token.approve(this.transfers.address, billingAmount, { from: subscriber1 });
        const result = await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin });

        expectEvent(result, 'Billing', expectEvent(result, 'Billing', {
          planId: this.planId,
          subscriptionId: this.subscriptionId,
          amount: billingAmount
        }));

        const subscription = await this.subscriptions.getSubscription(this.subscriptionId);
        expect(subscription.spent).to.be.bignumber.equal(billingAmount);
      });
    });

    describe('after billing failed', () => {
      beforeEach(async () => {
        await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin });
      });

      it('should successfully bill on retry', async () => {
        await this.token.transfer(subscriber1, billingAmount);
        await this.token.approve(this.transfers.address, billingAmount, { from: subscriber1 });

        const subscriptionId = this.subscriptionId;
        const subscriber1InitialBalance = await this.token.balanceOf(subscriber1);
        await this.subscriptionsManagement.bill(this.planId, [subscriptionId], [billingAmount], { from: planAdmin });
        const subscriber1FinalBalance = await this.token.balanceOf(subscriber1);

        expect(subscriber1FinalBalance).to.be.bignumber.equal(subscriber1InitialBalance.sub(billingAmount));
      });
    });

    describe('after canceling the subscription', () => {
      beforeEach(async () => {
        await this.subscriptions.cancel(this.subscriptionId, { from: subscriber1 });
      });

      it('should not bill an unsubscribed user', async () => {
        await time.increase(period.add(new BN(1)));
        const result = await this.subscriptionsManagement.bill(this.planId, [this.subscriptionId], [billingAmount], { from: planAdmin });
        expectEvent.notEmitted(result, 'Billing');
        expectEvent.notEmitted(result, 'BillingFailed');
      });
    });
  });

  describe('with multiple users subscribed', () => {
    beforeEach(async () => {
      const result1 = await this.subscriptions.subscribe(this.planId, allowance, { from: subscriber1 });
      const result2 = await this.subscriptions.subscribe(this.planId, allowance, { from: subscriber2 });

      this.subscriptionId1 = result1.receipt.logs[0].args.subscriptionId;
      this.subscriptionId2 = result2.receipt.logs[0].args.subscriptionId;
    });

    afterEach(async () => {
      await this.subscriptions.cancel(this.subscriptionId1, { from: subscriber1 });
      await this.subscriptions.cancel(this.subscriptionId2, { from: subscriber2 });
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
  });
});
