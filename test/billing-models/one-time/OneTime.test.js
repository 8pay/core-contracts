const OneTime = artifacts.require('OneTime');
const MockToken = artifacts.require('MockToken');
const Transfers = artifacts.require('Transfers');
const TokensRegistry = artifacts.require('TokensRegistry');
const FeeProviderMock = artifacts.require('FeeProviderMock');
const { expect } = require('chai');
const expectEvent = require('../../helpers/expect-event');
const { BN, expectRevert, constants } = require('@openzeppelin/test-helpers');
const Role = require('../../../data/roles');

contract('OneTime', accounts => {
  const [sender, receiver, owner, feeCollector] = accounts;
  const ETH_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const amount = new BN(1000);
  const description = 'OneTime';
  const category = 'Sample';
  const stringTag = 'MyTag';
  const tag = web3.utils.padRight(web3.utils.asciiToHex(stringTag), 64);
  const emptyTag = web3.utils.padRight('0x', 64);

  before(async () => {
    this.token = await MockToken.new();
    this.tokensRegistry = await TokensRegistry.new([this.token.address]);
    this.transfers = await Transfers.new(); ;
    this.feeProviderMock = await FeeProviderMock.new('0');
    this.oneTime = await OneTime.new();
    this.oneTime.initialize(this.transfers.address);
    this.transfers.initialize(this.tokensRegistry.address, this.feeProviderMock.address, feeCollector);
    this.transfers.initAccessControl([Role.OWNER, Role.NETWORK_CONTRACT], [owner, this.oneTime.address]);
  });

  it('should send an erc20 one-time', async () => {
    await this.token.transfer(sender, amount);
    await this.token.approve(this.transfers.address, amount, { from: sender });
    const senderInitialBalance = await this.token.balanceOf(sender);
    const receiverInitialBalance = await this.token.balanceOf(receiver);
    const result = await this.oneTime.send(description, this.token.address, [receiver], [amount], category, emptyTag, { from: sender });

    expectEvent(result, 'Payment', {
      sender: sender,
      token: this.token.address,
      description: description,
      category: category,
      tag: emptyTag
    });
    expectEvent(result, 'Receiver', { account: receiver, amount: amount });

    const senderFinalBalance = await this.token.balanceOf(sender);
    const receiverFinalBalance = await this.token.balanceOf(receiver);
    expect(senderFinalBalance).to.be.bignumber.equal(senderInitialBalance.sub(amount));
    expect(receiverFinalBalance).to.be.bignumber.equal(receiverInitialBalance.add(amount));
  });

  it('should send a ETH one-time', async () => {
    const senderInitialBalance = new BN(await web3.eth.getBalance(sender));
    const receiverInitialBalance = new BN(await web3.eth.getBalance(receiver));
    const result = await this.oneTime.send(
      description, ETH_TOKEN, [receiver], [amount], category, emptyTag, { from: sender, value: amount }
    );
    const gasPrice = (await web3.eth.getTransaction(result.tx)).gasPrice;
    const gasCost = new BN(gasPrice).mul(new BN(result.receipt.gasUsed));
    expectEvent(result, 'Payment', { sender: sender, token: ETH_TOKEN, description: description, category: category, tag: emptyTag });
    expectEvent(result, 'Receiver', { account: receiver, amount: amount });
    const senderFinalBalance = new BN(await web3.eth.getBalance(sender));
    const receiverFinalBalance = new BN(await web3.eth.getBalance(receiver));
    expect(senderFinalBalance).to.be.bignumber.equal(senderInitialBalance.sub(amount).sub(gasCost));
    expect(receiverFinalBalance).to.be.bignumber.equal(receiverInitialBalance.add(amount));
  });

  it('should send a one-time with tag', async () => {
    const result = await this.oneTime.send(description, ETH_TOKEN, [receiver], [amount], category, tag, { from: sender, value: amount });
    expectEvent(result, 'Payment', { sender: sender, token: ETH_TOKEN, description: description, category: category, tag: tag });
    expectEvent(result, 'Receiver', { account: receiver, amount: amount });
    const decodedTag = web3.utils.hexToAscii(result.receipt.logs[0].args.tag).replace(/\u0000/g, '');
    expect(decodedTag).to.be.equal(stringTag);
  });

  it('reverts when sending a one-time without enough funds', async () => {
    await expectRevert(
      this.oneTime.send(description, this.token.address, [receiver], [amount], category, emptyTag, { from: sender }),
      'OneTime: transfer failed'
    );
  });

  it('reverts when sending a one time without receivers', async () => {
    await expectRevert(
      this.oneTime.send(description, this.token.address, [], [], category, emptyTag, { from: sender }),
      'OneTime: no receivers'
    );
  });

  it('reverts when sending a one time with different receivers and amounts length', async () => {
    await expectRevert(
      this.oneTime.send(description, this.token.address, [receiver], [], category, emptyTag, { from: sender }),
      'OneTime: parameters length mismatch'
    );
  });

  it('reverts when sending value for an erc20 one time', async () => {
    await this.token.transfer(sender, amount);
    await this.token.approve(this.transfers.address, amount, { from: sender });
    await expectRevert(
      this.oneTime.send(description, this.token.address, [receiver], [amount], category, emptyTag, { from: sender, value: amount }),
      'OneTime: invalid msg value'
    );
  });

  it('reverts when sending a one time with empty description', async () => {
    await expectRevert(
      this.oneTime.send('', ETH_TOKEN, [receiver], [amount], category, emptyTag, { from: sender, value: amount }),
      'OneTime: description is empty'
    );
  });

  it('reverts when sending a one time with zero address as receiver', async () => {
    await expectRevert(
      this.oneTime.send(description, ETH_TOKEN, [constants.ZERO_ADDRESS], [amount], category, emptyTag, { from: sender, value: amount }),
      'OneTime: receiver is the zero address'
    );
  });

  it('reverts when sending a one time with 0 amount', async () => {
    await expectRevert(
      this.oneTime.send(description, ETH_TOKEN, [receiver], [0], category, emptyTag, { from: sender }),
      'OneTime: amount is zero'
    );
  });
});
