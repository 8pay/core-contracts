const Transfers = artifacts.require('Transfers');
const MockToken = artifacts.require('MockToken');
const FeeProviderMock = artifacts.require('FeeProviderMock');
const TokensRegistry = artifacts.require('TokensRegistry');
const { expect } = require('chai');
const { BN, expectRevert, constants } = require('@openzeppelin/test-helpers');
const expectEvent = require('../helpers/expect-event');
const Role = require('../../data/roles');
const PaymentType = require('../../data/payment-types');

contract('Transfers', accounts => {
  const [owner, networkContract, bob, alice, feeCollector] = accounts;
  const ETH_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const feePercentage = new BN(1);
  const rawFeePercentage = '100';
  const metadata = web3.utils.padRight('0x123', 64);

  beforeEach(async () => {
    this.token = await MockToken.new({ from: owner });
    this.randomToken = await MockToken.new({ from: owner });
    this.feeProvider = await FeeProviderMock.new(rawFeePercentage, { from: owner });
    this.tokensRegistry = await TokensRegistry.new([this.token.address], { from: owner });
    this.transfers = await Transfers.new({ from: owner });

    await this.transfers.initialize(
      this.tokensRegistry.address,
      this.feeProvider.address,
      feeCollector,
      { from: owner }
    );

    await this.transfers.initAccessControl(
      [Role.OWNER, Role.NETWORK_CONTRACT],
      [owner, networkContract],
      { from: owner }
    );
  });

  describe('transfers', () => {
    const sender = bob;
    const receiver = alice;
    const amount = new BN(1000);
    const fee = amount.mul(feePercentage).div(new BN(100));
    const netAmount = amount.sub(fee);

    describe('ERC20', () => {
      it('should execute an erc20 transfer', async () => {
        await this.token.approve(this.transfers.address, constants.MAX_UINT256, { from: bob });
        await this.token.transfer(bob, amount, { from: owner });

        const senderInitialBalance = await this.token.balanceOf(bob);
        const feeCollectorInitialBalance = await this.token.balanceOf(feeCollector);
        const receiverInitialBalance = await this.token.balanceOf(receiver);

        const params = [this.token.address, sender, receiver, amount, bob, PaymentType.ONE_TIME, metadata, { from: networkContract }];
        const success = await this.transfers.transfer.call(...params);

        expect(success).to.be.equal(true);

        const result = await this.transfers.transfer(...params);

        expectEvent(result, 'TransferSuccessful', {
          token: this.token.address,
          sender: sender,
          receiver: receiver,
          amount: amount,
          feePercentage: rawFeePercentage,
          paymentType: PaymentType.ONE_TIME,
          metadata: metadata
        });

        const senderFinalBalance = await this.token.balanceOf(sender);
        const feeCollectorFinalBalance = await this.token.balanceOf(feeCollector);
        const receiverFinalBalance = await this.token.balanceOf(receiver);

        expect(feeCollectorFinalBalance).to.be.bignumber.equal(feeCollectorInitialBalance.add(fee));
        expect(senderFinalBalance).to.be.bignumber.equal(senderInitialBalance.sub(amount));
        expect(receiverFinalBalance).to.be.bignumber.equal(receiverInitialBalance.add(netAmount));
      });

      it('should return false if not enough balance or allowance', async () => {
        const params = [this.token.address, sender, receiver, amount, bob, PaymentType.ONE_TIME, metadata, { from: networkContract }];
        const success = await this.transfers.transfer.call(...params);

        expect(success).to.be.equal(false);

        const result = await this.transfers.transfer(...params);

        expectEvent(result, 'TransferFailed', {
          token: this.token.address,
          sender: sender,
          receiver: receiver,
          amount: amount,
          paymentType: PaymentType.ONE_TIME,
          metadata: metadata
        });
      });

      it('reverts if token is not supported or active', async () => {
        await this.token.approve(this.transfers.address, constants.MAX_UINT256, { from: bob });
        await this.token.transfer(bob, amount, { from: owner });

        await expectRevert(
          this.transfers.transfer(
            this.randomToken.address, sender, receiver, amount, bob, PaymentType.ONE_TIME, metadata, { from: networkContract }
          ),
          'Transfers: inactive or unsupported token'
        );
      });

      it('reverts if receiver is the zero address', async () => {
        await expectRevert(
          this.transfers.transfer.call(
            this.token.address, sender, constants.ZERO_ADDRESS, amount, bob, PaymentType.ONE_TIME, metadata, { from: networkContract }
          ),
          'Transfers: receiver is the zero address'
        );
      });

      it('reverts if zero address sender', async () => {
        await expectRevert(
          this.transfers.transfer.call(
            this.token.address, constants.ZERO_ADDRESS, receiver, amount, bob, PaymentType.ONE_TIME, metadata, { from: networkContract }
          ),
          'Transfers: sender is the zero address'
        );
      });
    });

    describe('ETH', () => {
      it('should execute an ETH transfer', async () => {
        const feeCollectorInitialBalance = new BN(await web3.eth.getBalance(feeCollector));
        const receiverInitialBalance = new BN(await web3.eth.getBalance(receiver));

        const params = [
          ETH_TOKEN,
          sender,
          receiver,
          amount,
          bob,
          PaymentType.ONE_TIME,
          metadata,
          { from: networkContract, value: amount }
        ];

        const success = await this.transfers.transfer.call(...params);

        expect(success).to.be.equal(true);

        const result = await this.transfers.transfer(...params);

        expectEvent(result, 'TransferSuccessful', {
          token: ETH_TOKEN,
          sender: sender,
          receiver: receiver,
          amount: amount,
          feePercentage: rawFeePercentage,
          paymentType: PaymentType.ONE_TIME,
          metadata: metadata
        });

        const feeCollectorFinalBalance = new BN(await web3.eth.getBalance(feeCollector));

        expect(feeCollectorFinalBalance).to.be.bignumber.equal(feeCollectorInitialBalance.add(fee));

        const receiverFinalBalance = new BN(await web3.eth.getBalance(receiver));

        expect(receiverFinalBalance).to.be.bignumber.equal(receiverInitialBalance.add(netAmount));
      });

      it('should return false and send ETH back when executing a transfer with incorrect msg.value', async () => {
        const msgValue = web3.utils.toWei('1', 'ether');
        const initialBalance = new BN(await web3.eth.getBalance(networkContract));

        const params = [
          ETH_TOKEN,
          sender,
          receiver,
          amount,
          bob,
          PaymentType.ONE_TIME,
          metadata,
          { from: networkContract, value: msgValue }
        ];

        const success = await this.transfers.transfer.call(...params);

        expect(success).to.be.equal(false);

        const result = await this.transfers.transfer(...params);
        const gasPrice = (await web3.eth.getTransaction(result.tx)).gasPrice;
        const gasCost = new BN(gasPrice).mul(new BN(result.receipt.gasUsed));
        const finalBalance = new BN(await web3.eth.getBalance(networkContract));

        expectEvent(result, 'TransferFailed', {
          token: ETH_TOKEN,
          sender: sender,
          receiver: receiver,
          amount: amount,
          paymentType: PaymentType.ONE_TIME,
          metadata: metadata
        });

        expect(finalBalance).to.be.bignumber.equal(initialBalance.sub(gasCost));
      });
    });
  });

  describe('contracts references', () => {
    it('should set fee collector address', async () => {
      await this.transfers.setFeeCollector(alice, { from: owner });
      const address = await this.transfers.feeCollector();
      expect(address).to.be.equal(alice);
    });

    it('should set TokensRegistry address', async () => {
      const tokensRegistry = await TokensRegistry.new([]);
      await this.transfers.setTokensRegistry(tokensRegistry.address, { from: owner });
      const address = await this.transfers.tokensRegistry();
      expect(address).to.be.equal(tokensRegistry.address);
    });

    it('should set FeeProvider address', async () => {
      const feeProvider = await FeeProviderMock.new(rawFeePercentage);
      await this.transfers.setFeeProvider(feeProvider.address, { from: owner });
      const address = await this.transfers.feeProvider();
      expect(address).to.be.equal(feeProvider.address);
    });

    it('reverts when setting fee collector address from non-owner', async () => {
      await expectRevert(
        this.transfers.setFeeCollector(alice, { from: networkContract }),
        'AccessControl: permission denied'
      );
    });

    it('reverts when setting TokensRegistry address from non-owner', async () => {
      const tokensRegistry = await TokensRegistry.new([]);

      await expectRevert(
        this.transfers.setTokensRegistry(tokensRegistry.address, { from: networkContract }),
        'AccessControl: permission denied'
      );
    });

    it('reverts when setting FeeProvider address from non-owner', async () => {
      const feeProvider = await FeeProviderMock.new(rawFeePercentage);

      await expectRevert(
        this.transfers.setFeeProvider(feeProvider.address, { from: networkContract }),
        'AccessControl: permission denied'
      );
    });
  });
});
