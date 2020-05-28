const TokensRegistry = artifacts.require('TokensRegistry');
const { expect } = require('chai');
const MockToken = artifacts.require('MockToken');
const expectEvent = require('../helpers/expect-event');
const { expectRevert } = require('@openzeppelin/test-helpers');
const Role = require('../../data/roles');

contract('TokensRegistry', accounts => {
  const [owner, random] = accounts;

  beforeEach(async () => {
    this.token1 = await MockToken.new({ from: owner });
    this.token2 = await MockToken.new({ from: owner });
    this.unsupportedToken = await MockToken.new({ from: owner });
    this.tokensRegistry = await TokensRegistry.new([this.token1.address], { from: owner });
    await this.tokensRegistry.initAccessControl([Role.OWNER], [owner], { from: owner });
  });

  it('should check initial tokens', async () => {
    const isSupported = await this.tokensRegistry.isSupported(this.token1.address);
    const isActive = await this.tokensRegistry.isActive(this.token1.address);
    expect(isSupported).to.be.equal(true);
    expect(isActive).to.be.equal(true);
  });

  it('should get all supported tokens', async () => {
    const tokens = await this.tokensRegistry.getSupportedTokens();
    expect(tokens).to.include(this.token1.address);
  });

  it('should add a new token', async () => {
    const result = await this.tokensRegistry.addToken(this.token2.address, { from: owner });
    expectEvent(result, 'TokenAdded', { token: this.token2.address });
    const isSupported = await this.tokensRegistry.isSupported(this.token2.address);
    const isActive = await this.tokensRegistry.isActive(this.token2.address);
    expect(isSupported).to.be.equal(true);
    expect(isActive).to.be.equal(true);
  });

  it('reverts when adding a new token from non-owner', async () => {
    await expectRevert(
      this.tokensRegistry.addToken(this.token2.address, { from: random }),
      'AccessControl: permission denied'
    );
  });

  describe('after token added', () => {
    beforeEach(async () => {
      await this.tokensRegistry.addToken(this.token2.address, { from: owner });
    });

    it('reverts when adding the same token again', async () => {
      await expectRevert(
        this.tokensRegistry.addToken(this.token2.address, { from: owner }),
        'TokensRegistry: token is already supported'
      );
    });

    it('should return the same token if no redirects set', async () => {
      const mostRecentAddress = await this.tokensRegistry.getLatestAddress(this.token1.address);
      expect(mostRecentAddress).to.be.equal(this.token1.address);
    });

    it('should set a redirect for a token', async () => {
      const result = await this.tokensRegistry.setRedirect(this.token1.address, this.token2.address, { from: owner });
      expectEvent(result, 'TokenRedirected', { token: this.token1.address, newToken: this.token2.address });
      const mostRecentAddress = await this.tokensRegistry.getLatestAddress(this.token1.address);
      expect(mostRecentAddress).to.be.equal(this.token2.address);
    });

    it('reverts when setting a redirect from non-owner', async () => {
      await expectRevert(
        this.tokensRegistry.setRedirect(this.token1.address, this.token2.address, { from: random }),
        'AccessControl: permission denied'
      );
    });

    it('reverts when setting a redirect to the same token', async () => {
      await expectRevert(
        this.tokensRegistry.setRedirect(this.token1.address, this.token1.address, { from: owner }),
        'TokensRegistry: cannot redirect to the same token'
      );
    });

    it('reverts when setting a redirect from an unsupported token', async () => {
      await expectRevert(
        this.tokensRegistry.setRedirect(this.unsupportedToken.address, this.token2.address, { from: owner }),
        'TokensRegistry: token is not supported'
      );
    });

    it('reverts when setting a redirect to an unsupported token', async () => {
      await expectRevert(
        this.tokensRegistry.setRedirect(this.token1.address, this.unsupportedToken.address, { from: owner }),
        'TokensRegistry: token is not supported'
      );
    });

    it('should pause a token', async () => {
      const result = await this.tokensRegistry.pauseToken(this.token1.address, { from: owner });
      expectEvent(result, 'TokenPaused', { token: this.token1.address });
      const isSupported = await this.tokensRegistry.isSupported(this.token1.address);
      const isActive = await this.tokensRegistry.isActive(this.token1.address);
      expect(isSupported).to.be.equal(true);
      expect(isActive).to.be.equal(false);
    });

    it('reverts when pausing token from non-owner', async () => {
      await expectRevert(
        this.tokensRegistry.pauseToken(this.token1.address, { from: random }),
        'AccessControl: permission denied'
      );
    });
  });

  describe('when token paused', async () => {
    beforeEach(async () => {
      await this.tokensRegistry.pauseToken(this.token1.address, { from: owner });
    });

    it('reverts when pausing again', async () => {
      await expectRevert(
        this.tokensRegistry.pauseToken(this.token1.address, { from: owner }),
        'TokensRegistry: token is not active'
      );
    });

    it('should resume token', async () => {
      const result = await this.tokensRegistry.resumeToken(this.token1.address, { from: owner });
      expectEvent(result, 'TokenResumed', { token: this.token1.address });
      const isSupported = await this.tokensRegistry.isSupported(this.token1.address);
      const isActive = await this.tokensRegistry.isActive(this.token1.address);
      expect(isSupported).to.be.equal(true);
      expect(isActive).to.be.equal(true);
    });

    it('reverts when resuming from non-owner', async () => {
      await expectRevert(
        this.tokensRegistry.resumeToken(this.token1.address, { from: random }),
        'AccessControl: permission denied'
      );
    });

    describe('when token resumed', async () => {
      beforeEach(async () => {
        await this.tokensRegistry.resumeToken(this.token1.address, { from: owner });
      });

      it('reverts when unpausing again', async () => {
        await expectRevert(
          this.tokensRegistry.resumeToken(this.token1.address, { from: owner }),
          'TokensRegistry: token is not paused'
        );
      });
    });
  });
});
