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
  const [owner, networkContract, bob, alice, eve, mallory, trent, feeCollector] = accounts;
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
    const receivers = [alice, eve];
    const amounts = [new BN(400), new BN(600)];
    const totAmount = amounts.reduce((a, e) => a.add(e), new BN(0));
    const feePerReceiver = amounts.map(e => e.mul(feePercentage).div(new BN(100)));
    const totFee = feePerReceiver.reduce((a, e) => a.add(e), new BN(0));
    const netAmounts = amounts.map((e, i) => e.sub(feePerReceiver[i]));

    describe('ERC20', () => {
      it('should execute an erc20 transfer', async () => {
        await this.token.approve(this.transfers.address, constants.MAX_UINT256, { from: bob });
        await this.token.transfer(bob, totAmount, { from: owner });

        const senderInitialBalance = await this.token.balanceOf(bob);
        const feeCollectorInitialBalance = await this.token.balanceOf(feeCollector);
        const receiversInitialBalance = [];

        for (let i = 0; i < receivers.length; i++) {
          receiversInitialBalance[i] = await this.token.balanceOf(receivers[i]);
        }

        const params = [this.token.address, sender, receivers, amounts, bob, PaymentType.ONE_TIME, metadata, { from: networkContract }];
        const success = await this.transfers.transfer.call(...params);

        expect(success).to.be.equal(true);

        const result = await this.transfers.transfer(...params);

        expectEvent(result, 'TransferSuccessful', {
          token: this.token.address,
          sender: sender,
          receivers: receivers,
          amounts: amounts,
          feePercentage: rawFeePercentage,
          paymentType: PaymentType.ONE_TIME,
          metadata: metadata
        });

        const senderFinalBalance = await this.token.balanceOf(sender);
        const feeCollectorFinalBalance = await this.token.balanceOf(feeCollector);

        expect(feeCollectorFinalBalance).to.be.bignumber.equal(feeCollectorInitialBalance.add(totFee));
        expect(senderFinalBalance).to.be.bignumber.equal(senderInitialBalance.sub(totAmount));

        for (let i = 0; i < receivers.length; i++) {
          const finalBalance = await this.token.balanceOf(receivers[i]);
          expect(finalBalance).to.be.bignumber.equal(receiversInitialBalance[i].add(netAmounts[i]));
        }
      });

      it('should return false if not enough balance or allowance', async () => {
        const params = [this.token.address, sender, receivers, amounts, bob, PaymentType.ONE_TIME, metadata, { from: networkContract }];
        const success = await this.transfers.transfer.call(...params);

        expect(success).to.be.equal(false);

        const result = await this.transfers.transfer(...params);

        expectEvent(result, 'TransferFailed', {
          token: this.token.address,
          sender: sender,
          receivers: receivers,
          amounts: amounts,
          paymentType: PaymentType.ONE_TIME,
          metadata: metadata
        });
      });

      it('reverts if token is not supported or active', async () => {
        await this.token.approve(this.transfers.address, constants.MAX_UINT256, { from: bob });
        await this.token.transfer(bob, totAmount, { from: owner });

        await expectRevert(
          this.transfers.transfer(
            this.randomToken.address, sender, receivers, amounts, bob, PaymentType.ONE_TIME, metadata, { from: networkContract }
          ),
          'Transfers: inactive or unsupported token'
        );
      });

      it('reverts if zero address in receivers', async () => {
        const invalidReceivers = receivers.map(() => constants.ZERO_ADDRESS);

        await expectRevert(
          this.transfers.transfer.call(
            this.token.address, sender, invalidReceivers, amounts, bob, PaymentType.ONE_TIME, metadata, { from: networkContract }
          ),
          'Transfers: receiver is the zero address'
        );
      });

      it('reverts if zero address sender', async () => {
        await expectRevert(
          this.transfers.transfer.call(
            this.token.address, constants.ZERO_ADDRESS, receivers, amounts, bob, PaymentType.ONE_TIME, metadata, { from: networkContract }
          ),
          'Transfers: sender is the zero address'
        );
      });

      it('reverts if empty receivers array', async () => {
        await expectRevert(
          this.transfers.transfer.call(
            this.token.address,
            sender,
            [],
            amounts,
            bob,
            PaymentType.ONE_TIME,
            metadata,
            { from: networkContract }
          ),
          'Transfers: no receivers'
        );
      });

      it('reverts if empty amounts array', async () => {
        await expectRevert(
          this.transfers.transfer.call(
            this.token.address,
            sender,
            receivers,
            [],
            bob,
            PaymentType.ONE_TIME,
            metadata,
            { from: networkContract }
          ),
          'Transfers: parameters length mismatch'
        );
      });

      it('reverts if receivers and amounts arrays length is different', async () => {
        const invalidAmounts = amounts.slice(0, -1);

        await expectRevert(
          this.transfers.transfer.call(
            this.token.address,
            sender,
            receivers,
            invalidAmounts,
            bob,
            PaymentType.ONE_TIME,
            metadata,
            { from: networkContract }
          ),
          'Transfers: parameters length mismatch'
        );
      });
    });

    describe('ETH', () => {
      it('should execute an ETH transfer', async () => {
        const feeCollectorInitialBalance = new BN(await web3.eth.getBalance(feeCollector));
        const receiversInitialBalance = [];

        for (let i = 0; i < receivers.length; i++) {
          receiversInitialBalance[i] = new BN(await web3.eth.getBalance(receivers[i]));
        }

        const params = [
          ETH_TOKEN,
          sender,
          receivers,
          amounts,
          bob,
          PaymentType.ONE_TIME,
          metadata,
          { from: networkContract, value: totAmount }
        ];

        const success = await this.transfers.transfer.call(...params);

        expect(success).to.be.equal(true);

        const result = await this.transfers.transfer(...params);

        expectEvent(result, 'TransferSuccessful', {
          token: ETH_TOKEN,
          sender: sender,
          receivers: receivers,
          amounts: amounts,
          feePercentage: rawFeePercentage,
          paymentType: PaymentType.ONE_TIME,
          metadata: metadata
        });

        const feeCollectorFinalBalance = new BN(await web3.eth.getBalance(feeCollector));

        expect(feeCollectorFinalBalance).to.be.bignumber.equal(feeCollectorInitialBalance.add(totFee));

        for (let i = 0; i < receivers.length; i++) {
          const finalBalance = new BN(await web3.eth.getBalance(receivers[i]));
          expect(finalBalance).to.be.bignumber.equal(receiversInitialBalance[i].add(netAmounts[i]));
        }
      });

      it('should return false and send ETH back when executing a transfer with incorrect msg.value', async () => {
        const msgValue = web3.utils.toWei('1', 'ether');
        const initialBalance = new BN(await web3.eth.getBalance(networkContract));

        const params = [
          ETH_TOKEN,
          sender,
          receivers,
          amounts,
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
          receivers: receivers,
          amounts: amounts,
          paymentType: PaymentType.ONE_TIME,
          metadata: metadata
        });

        expect(finalBalance).to.be.bignumber.equal(initialBalance.sub(gasCost));
      });

      it('reverts if empty receivers array', async () => {
        await expectRevert(
          this.transfers.transfer.call(ETH_TOKEN, sender, [], amounts, bob, PaymentType.ONE_TIME, metadata, { from: networkContract }),
          'Transfers: no receivers'
        );
      });

      it('reverts if empty amounts array', async () => {
        await expectRevert(
          this.transfers.transfer.call(ETH_TOKEN, sender, receivers, [], bob, PaymentType.ONE_TIME, metadata, { from: networkContract }),
          'Transfers: parameters length mismatch'
        );
      });

      it('reverts if receivers and amounts arrays length is different', async () => {
        const invalidAmounts = amounts.slice(0, -1);

        await expectRevert(
          this.transfers.transfer.call(
            ETH_TOKEN,
            sender,
            receivers,
            invalidAmounts,
            bob,
            PaymentType.ONE_TIME,
            metadata,
            { from: networkContract }
          ),
          'Transfers: parameters length mismatch'
        );
      });
    });
  });

  describe('batch transfers', () => {
    const senders = [bob, alice];
    const receivers = [eve, mallory];
    const amounts = [[new BN(600), new BN(400)], [new BN(700), new BN(300)]];
    const totAmountPerSender = amounts.map(e => e.reduce((a, c) => a.add(c), new BN(0)));
    const totAmountPerReceiver = amounts.map(() => new BN(0));
    amounts.forEach(a => a.forEach((e, i) => { totAmountPerReceiver[i] = totAmountPerReceiver[i].add(e); }));
    const totFeePerReceiver = totAmountPerReceiver.map(e => e.mul(feePercentage).div(new BN(100)));
    const totFee = totFeePerReceiver.reduce((a, e) => a.add(e), new BN(0));
    const netAmountPerReceiver = totAmountPerReceiver.map((e, i) => e.sub(totFeePerReceiver[i]));
    const batchMetadata = senders.map(() => metadata);

    it('should execute a batch transfer', async () => {
      const senderInitialBalances = [];
      const receiverInitialBalances = [];

      for (let i = 0; i < senders.length; i++) {
        await this.token.transfer(senders[i], totAmountPerSender[i], { from: owner });
        await this.token.approve(this.transfers.address, totAmountPerSender[i], { from: senders[i] });

        senderInitialBalances[i] = await this.token.balanceOf(senders[i]);
      }

      for (let i = 0; i < receivers.length; i++) {
        receiverInitialBalances[i] = await this.token.balanceOf(receivers[i]);
      }

      const feeCollectorInitialBalance = await this.token.balanceOf(feeCollector);

      const params = [
        this.token.address,
        senders,
        receivers,
        amounts,
        constants.ZERO_ADDRESS,
        PaymentType.ONE_TIME,
        batchMetadata,
        { from: networkContract }
      ];

      const success = await this.transfers.batchTransfers.call(...params);

      expect(success[0]).to.be.equal(true);
      expect(success[1]).to.be.equal(true);

      const result = await this.transfers.batchTransfers(...params);

      const senderFinalBalances = [];
      const receiverFinalBalances = [];

      for (let i = 0; i < senders.length; i++) {
        senderFinalBalances[i] = await this.token.balanceOf(senders[i]);
      }

      for (let i = 0; i < receivers.length; i++) {
        receiverFinalBalances[i] = await this.token.balanceOf(receivers[i]);
      }

      const feeCollectorFinalBalance = await this.token.balanceOf(feeCollector);

      for (let i = 0; i < senders.length; i++) {
        expectEvent(result, 'TransferSuccessful', {
          token: this.token.address,
          sender: senders[i],
          receivers: receivers,
          amounts: amounts[i],
          feePercentage: rawFeePercentage,
          paymentType: PaymentType.ONE_TIME,
          metadata: metadata
        });

        expect(senderFinalBalances[i]).to.be.bignumber.equal(senderInitialBalances[i].sub(totAmountPerSender[i]));
      }

      for (let i = 0; i < receivers.length; i++) {
        expect(receiverFinalBalances[i]).to.be.bignumber.equal(receiverInitialBalances[i].add(netAmountPerReceiver[i]));
      }

      expect(feeCollectorFinalBalance).to.be.bignumber.equal(feeCollectorInitialBalance.add(totFee));
    });

    it('should execute a batch transfer with failed transfers', async () => {
      const extraSender = trent;
      const extraAmounts = [new BN(200), new BN(300)];
      const senderInitialBalances = [];
      const receiverInitialBalances = [];

      for (let i = 0; i < senders.length; i++) {
        await this.token.transfer(senders[i], totAmountPerSender[i], { from: owner });
        await this.token.approve(this.transfers.address, totAmountPerSender[i], { from: senders[i] });

        senderInitialBalances[i] = await this.token.balanceOf(senders[i]);
      }

      for (let i = 0; i < receivers.length; i++) {
        receiverInitialBalances[i] = await this.token.balanceOf(receivers[i]);
      }

      const extraSenderInitialBalance = await this.token.balanceOf(extraSender);
      const feeCollectorInitialBalance = await this.token.balanceOf(feeCollector);

      const params = [
        this.token.address,
        [...senders, extraSender],
        receivers,
        [...amounts, extraAmounts],
        constants.ZERO_ADDRESS,
        PaymentType.ONE_TIME,
        [...batchMetadata, metadata],
        { from: networkContract }
      ];

      const success = await this.transfers.batchTransfers.call(...params);

      expect(success[0]).to.be.equal(true);
      expect(success[1]).to.be.equal(true);
      expect(success[2]).to.be.equal(false);

      const result = await this.transfers.batchTransfers(...params);

      const senderFinalBalances = [];
      const receiverFinalBalances = [];

      for (let i = 0; i < senders.length; i++) {
        senderFinalBalances[i] = await this.token.balanceOf(senders[i]);
      }

      for (let i = 0; i < receivers.length; i++) {
        receiverFinalBalances[i] = await this.token.balanceOf(receivers[i]);
      }

      const extraSenderFinalBalance = await this.token.balanceOf(extraSender);
      const feeCollectorFinalBalance = await this.token.balanceOf(feeCollector);

      for (let i = 0; i < senders.length; i++) {
        expectEvent(result, 'TransferSuccessful', {
          token: this.token.address,
          sender: senders[i],
          receivers: receivers,
          amounts: amounts[i],
          feePercentage: rawFeePercentage,
          paymentType: PaymentType.ONE_TIME,
          metadata: metadata
        });

        expect(senderFinalBalances[i]).to.be.bignumber.equal(senderInitialBalances[i].sub(totAmountPerSender[i]));
      }

      for (let i = 0; i < receivers.length; i++) {
        expect(receiverFinalBalances[i]).to.be.bignumber.equal(receiverInitialBalances[i].add(netAmountPerReceiver[i]));
      }

      expect(extraSenderFinalBalance).to.be.bignumber.equal(extraSenderInitialBalance);
      expect(feeCollectorFinalBalance).to.be.bignumber.equal(feeCollectorInitialBalance.add(totFee));
    });

    it('reverts if empty senders array', async () => {
      const params = [
        this.token.address,
        [],
        receivers,
        amounts,
        constants.ZERO_ADDRESS,
        PaymentType.ONE_TIME,
        batchMetadata,
        { from: networkContract }
      ];

      await expectRevert(this.transfers.batchTransfers(...params), 'Transfers: no senders');
    });

    it('reverts if senders and amounts array lenghts do not match', async () => {
      const invalidAmounts = amounts.slice(0, -1);

      const params = [
        this.token.address,
        senders,
        receivers,
        invalidAmounts,
        constants.ZERO_ADDRESS,
        PaymentType.ONE_TIME,
        batchMetadata,
        { from: networkContract }
      ];

      await expectRevert(this.transfers.batchTransfers(...params), 'Transfers: parameters length mismatch');
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
