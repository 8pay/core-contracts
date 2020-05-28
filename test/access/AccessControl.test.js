const AccessControlMock = artifacts.require('AccessControlMock');
const { expect } = require('chai');
const expectEvent = require('../helpers/expect-event');
const { expectRevert } = require('@openzeppelin/test-helpers');
const Role = require('../../data/roles');

contract('AccessControl', accounts => {
  const [owner, networkContract1, networkContract2, random] = accounts;

  beforeEach(async () => {
    this.accessControl = await AccessControlMock.new({ from: owner });
  });

  describe('when not initialized', async () => {
    it('should initialize access control', async () => {
      await this.accessControl.initAccessControl(
        [Role.OWNER, Role.NETWORK_CONTRACT],
        [owner, networkContract1]
      );
    });

    it('reverts when initializing without at least an owner', async () => {
      await expectRevert(
        this.accessControl.initAccessControl([Role.NETWORK_CONTRACT], [networkContract1]),
        'AccessControl: no owner provided'
      );
    });

    it('reverts when initializing with invalid parameters', async () => {
      await expectRevert(
        this.accessControl.initAccessControl([Role.NETWORK_CONTRACT], []),
        'AccessControl: parameters length mismatch'
      );
    });

    it('reverts when calling a reserved functions', async () => {
      await expectRevert(
        this.accessControl.callableByRole(Role.OWNER, { from: owner }),
        'AccessControl: permission denied'
      );
    });
  });

  describe('when initialized', async () => {
    beforeEach(async () => {
      this.result = await this.accessControl.initAccessControl(
        [Role.OWNER, Role.NETWORK_CONTRACT],
        [owner, networkContract1]
      );
    });

    it('reverts when initializing again', async () => {
      await expectRevert(
        this.accessControl.initAccessControl([Role.OWNER, Role.NETWORK_CONTRACT], [owner, networkContract1]),
        'AccessControl: already initialized'
      );
    });

    it('should check owner roles', async () => {
      const ownerHasOwnerRole = await this.accessControl.hasRole(Role.OWNER, owner);
      const ownerHasNetworkContractRole = await this.accessControl.hasRole(Role.NETWORK_CONTRACT, owner);
      expect(ownerHasOwnerRole).to.be.equal(true);
      expect(ownerHasNetworkContractRole).to.be.equal(false);
    });

    it('should grant a role', async () => {
      const isNetworkContractBefore = await this.accessControl.hasRole(Role.NETWORK_CONTRACT, networkContract2);
      expect(isNetworkContractBefore).to.be.equal(false);
      const result = await this.accessControl.grantRole(Role.NETWORK_CONTRACT, networkContract2, { from: owner });
      expectEvent(result, 'RoleGranted', { role: Role.NETWORK_CONTRACT, account: networkContract2, sender: owner });
      const isNetworkContractAfter = await this.accessControl.hasRole(Role.NETWORK_CONTRACT, networkContract2);
      expect(isNetworkContractAfter).to.be.equal(true);
    });

    it('reverts when granting a role from non-owner', async () => {
      await expectRevert(
        this.accessControl.grantRole(Role.NETWORK_CONTRACT, networkContract2, { from: networkContract1 }),
        'AccessControl: permission denied'
      );
    });

    describe('when role granted', async () => {
      beforeEach(async () => {
        await this.accessControl.grantRole(Role.NETWORK_CONTRACT, networkContract2, { from: owner });
      });

      it('should revoke the role', async () => {
        const isNetworkContractBefore = await this.accessControl.hasRole(Role.NETWORK_CONTRACT, networkContract2);
        expect(isNetworkContractBefore).to.be.equal(true);
        const result = await this.accessControl.revokeRole(Role.NETWORK_CONTRACT, networkContract2, { from: owner });
        expectEvent(result, 'RoleRevoked', { role: Role.NETWORK_CONTRACT, account: networkContract2, sender: owner });
        const isNetworkContractAfter = await this.accessControl.hasRole(Role.NETWORK_CONTRACT, networkContract2);
        expect(isNetworkContractAfter).to.be.equal(false);
      });

      it('should renounce the role', async () => {
        const isNetworkContractBefore = await this.accessControl.hasRole(Role.NETWORK_CONTRACT, networkContract2);
        expect(isNetworkContractBefore).to.be.equal(true);
        const result = await this.accessControl.renounceRole(Role.NETWORK_CONTRACT, { from: networkContract2 });
        expectEvent(result, 'RoleRevoked', { role: Role.NETWORK_CONTRACT, account: networkContract2, sender: networkContract2 });
        const isNetworkContractAfter = await this.accessControl.hasRole(Role.NETWORK_CONTRACT, networkContract2);
        expect(isNetworkContractAfter).to.be.equal(false);
      });

      it('reverts when renouncing non possessed role', async () => {
        await expectRevert(
          this.accessControl.renounceRole(Role.NETWORK_CONTRACT, { from: random }),
          'AccessControl: permission denied'
        );
      });

      it('reverts when revoking the role from non-owner', async () => {
        await expectRevert(
          this.accessControl.grantRole(Role.NETWORK_CONTRACT, networkContract2, { from: networkContract1 }),
          'AccessControl: permission denied'
        );
      });

      it('should be able to call a role-reserved function', async () => {
        await this.accessControl.callableByRole(Role.NETWORK_CONTRACT, { from: networkContract2 });
      });

      it('reverts when calling a function role-reserved function from a non-privileged account', async () => {
        await expectRevert(
          this.accessControl.callableByRole(Role.NETWORK_CONTRACT, { from: random }),
          'AccessControl: permission denied'
        );
      });
    });
  });
});
