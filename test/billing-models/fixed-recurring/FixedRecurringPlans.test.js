const FixedRecurringPlans = artifacts.require('FixedRecurringPlans');
const FixedRecurringPlansDatabase = artifacts.require('FixedRecurringPlansDatabase');
const MockToken = artifacts.require('MockToken');
const TokensRegistry = artifacts.require('TokensRegistry');
const { expect } = require('chai');
const expectEvent = require('../../helpers/expect-event');
const { expectRevert, constants, time } = require('@openzeppelin/test-helpers');
const Permission = require('../../helpers/permissions');
const Role = require('../../../data/roles');

contract('FixedRecurringPlans', accounts => {
  const [owner, planAdmin, receiver, operator1, operator2, random] = accounts;
  const name = 'fixed';
  const category = 'transport';
  const amount = '4000';
  const period = time.duration.days(30);

  beforeEach(async () => {
    this.token = await MockToken.new();
    this.tokensRegistry = await TokensRegistry.new([this.token.address]);
    this.plansDb = await FixedRecurringPlansDatabase.new();
    this.plans = await FixedRecurringPlans.new();

    await this.plans.initialize(this.plansDb.address, this.tokensRegistry.address);
    await this.plansDb.initAccessControl([Role.OWNER, Role.NETWORK_CONTRACT], [owner, this.plans.address]);
  });

  it('should create a plan', async () => {
    const result = await this.plans.createPlan(
      name,
      amount,
      this.token.address,
      period,
      receiver,
      category,
      { from: planAdmin }
    );

    this.planId = result.receipt.logs[0].args.id;

    expectEvent(result, 'PlanCreated', {
      id: this.planId,
      admin: planAdmin,
      name: name,
      amount: amount,
      token: this.token.address,
      period: period,
      receiver: receiver,
      category: category
    });

    const exists = await this.plans.exists(this.planId);
    expect(exists).to.be.equal(true);
  });

  it('reverts when getting a non existent plan', async () => {
    const invalidPlanId = web3.utils.padRight('0x1', 64);

    await expectRevert(this.plans.getPlan(invalidPlanId), 'FRP: invalid plan id');
  });

  it('reverts when creating a plan with empty name', async () => {
    await expectRevert(
      this.plans.createPlan(
        '',
        amount,
        this.token.address,
        period,
        receiver,
        category,
        { from: planAdmin }
      ),
      'FRP: name is empty'
    );
  });

  it('reverts when creating a plan with unsupported token', async () => {
    await expectRevert(
      this.plans.createPlan(
        name,
        amount,
        this.plans.address,
        period,
        receiver,
        category,
        { from: planAdmin }
      ),
      'FRP: token is not supported'
    );
  });

  it('reverts when creating a plan with a period too short', async () => {
    await expectRevert(
      this.plans.createPlan(
        name,
        amount,
        this.token.address,
        300,
        receiver,
        category,
        { from: planAdmin }
      ),
      'FRP: period is too short'
    );
  });

  it('reverts when creating a plan with invalid receiver', async () => {
    await expectRevert(
      this.plans.createPlan(
        name,
        amount,
        this.token.address,
        period,
        constants.ZERO_ADDRESS,
        category,
        { from: planAdmin }
      ),
      'FRP: receiver is the zero address'
    );
  });

  it('reverts when creating a plan with invalid amount', async () => {
    await expectRevert(
      this.plans.createPlan(
        name,
        '0',
        this.token.address,
        period,
        receiver,
        category,
        { from: planAdmin }
      ),
      'FRP: amount is zero'
    );
  });

  describe('after creating a plan', () => {
    beforeEach(async () => {
      const result = await this.plans.createPlan(
        name,
        amount,
        this.token.address,
        period,
        receiver,
        category,
        { from: planAdmin }
      );

      this.planId = result.receipt.logs[0].args.id;
    });

    it('should get the plan', async () => {
      const plan = await this.plans.getPlan(this.planId);
      expect(plan.admin).to.be.equal(planAdmin);
      expect(plan.period).to.be.bignumber.equal(period);
      expect(plan.token).to.be.equal(this.token.address);
      expect(plan.receiver).to.be.equal(receiver);
      expect(plan.amount).to.be.bignumber.equal(amount);
    });

    it('should check plan admin', async () => {
      let isAdmin = await this.plans.isAdmin(this.planId, planAdmin);
      expect(isAdmin).to.be.equal(true);
      isAdmin = await this.plans.isAdmin(this.planId, receiver);
      expect(isAdmin).to.be.equal(false);
    });

    it('should change receiver', async () => {
      const newReceiver = random;
      const result = await this.plans.changeReceiver(this.planId, newReceiver, { from: planAdmin });
      expectEvent(result, 'ReceiverChanged', { planId: this.planId, receiver: newReceiver });
      const plan = await this.plans.getPlan(this.planId);
      expect(plan.receiver).to.be.equal(newReceiver);
    });

    it('reverts when changing receiver from non-admin', async () => {
      const newReceiver = random;

      await expectRevert(
        this.plans.changeReceiver(this.planId, newReceiver, { from: random }),
        'FRP: caller is not plan\'s admin'
      );
    });

    it('should grant terminate permission', async () => {
      const result = await this.plans.grantPermission(this.planId, Permission.TERMINATE, [operator1], { from: planAdmin });
      expectEvent(result, 'PermissionGranted', { planId: this.planId, account: operator1, permission: Permission.TERMINATE });

      const hasPermission = await this.plans.hasPermission(this.planId, Permission.TERMINATE, operator1);
      expect(hasPermission).to.be.equal(true);
    });

    it('reverts when granting terminate permissions from non-admin', async () => {
      await expectRevert(
        this.plans.grantPermission(this.planId, Permission.TERMINATE, [operator2], { from: random }),
        'FRP: caller is not plan\'s admin'
      );
    });

    it('reverts when granting an invalid permission', async () => {
      const invalidPermission = web3.utils.sha3('INVALID_PERMISSION');

      await expectRevert(
        this.plans.grantPermission(this.planId, invalidPermission, [operator2], { from: planAdmin }),
        'FRP: invalid permission'
      );
    });

    it('should do nothing when revoking terminate permissions before granting it', async () => {
      const result = await this.plans.revokePermission(this.planId, Permission.TERMINATE, [operator1], { from: planAdmin });
      expectEvent.notEmitted(result, 'PermissionGranted');
    });

    describe('after granting terminate permission', () => {
      beforeEach(async () => {
        await this.plans.grantPermission(this.planId, Permission.TERMINATE, [operator1], { from: planAdmin });
      });

      it('should do nothing when granting the permission again', async () => {
        const result = await this.plans.grantPermission(this.planId, Permission.TERMINATE, [operator1], { from: planAdmin });
        expectEvent.notEmitted(result, 'PermissionRevoked');
      });

      it('should revoke terminate permission', async () => {
        const result = await this.plans.revokePermission(this.planId, Permission.TERMINATE, [operator1], { from: planAdmin });
        expectEvent(result, 'PermissionRevoked', { planId: this.planId, account: operator1, permission: Permission.TERMINATE });

        const hasPermission = await this.plans.hasPermission(this.planId, Permission.TERMINATE, operator1);
        expect(hasPermission).to.be.equal(false);
      });

      it('reverts when revoking terminate permissions from non-admin', async () => {
        await expectRevert(
          this.plans.revokePermission(this.planId, Permission.TERMINATE, [operator1], { from: random }),
          'FRP: caller is not plan\'s admin'
        );
      });
    });
  });
});
