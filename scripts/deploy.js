const { ethers, upgrades, getNamedAccounts, network } = require('hardhat');
const Role = require('../data/roles');
const tokens = require('../data/tokens');
const baseFees = require('../data/base-fees');

async function main () {
  const { multiSigWallet, feeCollector } = await getNamedAccounts();

  /* Tokens registry */
  const TokensRegistry = await ethers.getContractFactory('TokensRegistry');
  const tokensRegistry = await TokensRegistry.deploy(tokens[network.name]);

  await tokensRegistry.deployed();
  await tokensRegistry.initAccessControl([Role.OWNER], [multiSigWallet]);

  console.log(`TokensRegistry: ${tokensRegistry.address}`);

  /* Fee provider */
  const FeeProvider = await ethers.getContractFactory('FeeProvider');
  const feeProvider = await FeeProvider.deploy(Object.keys(baseFees), Object.values(baseFees));

  await feeProvider.deployed();
  await feeProvider.initAccessControl([Role.OWNER], [multiSigWallet]);

  console.log(`FeeProvider: ${feeProvider.address}`);

  /* Transfers */
  const Transfers = await ethers.getContractFactory('Transfers');
  const transfers = await upgrades.deployProxy(Transfers, [
    tokensRegistry.address,
    feeProvider.address,
    feeCollector
  ]);

  await transfers.deployed();

  console.log(`Transfers: ${transfers.address}`);

  /* One Time */
  const OneTime = await ethers.getContractFactory('OneTime');
  const oneTime = await upgrades.deployProxy(OneTime, [transfers.address]);

  await oneTime.deployed();

  console.log(`OneTime: ${oneTime.address}`);

  /* Fixed Recurring */
  const FixedRecurringPlans = await ethers.getContractFactory('FixedRecurringPlans');
  const FixedRecurringDatabase = await ethers.getContractFactory('FixedRecurringPlansDatabase');
  const FixedRecurringSubscriptions = await ethers.getContractFactory('FixedRecurringSubscriptions');
  const FixedRecurringSubscriptionsManagement = await ethers.getContractFactory('FixedRecurringSubscriptionsManagement');
  const FixedRecurringSubscriptionsDatabase = await ethers.getContractFactory('FixedRecurringSubscriptionsDatabase');

  const fixedRecurringPlansDatabase = await upgrades.deployProxy(FixedRecurringDatabase);
  const fixedRecurringSubscriptionsDatabase = await upgrades.deployProxy(FixedRecurringSubscriptionsDatabase);

  await fixedRecurringPlansDatabase.deployed();
  await fixedRecurringSubscriptionsDatabase.deployed();

  console.log(`FixedRecurringPlansDatabase: ${fixedRecurringPlansDatabase.address}`);
  console.log(`FixedRecurringSubscriptionsDatabase: ${fixedRecurringSubscriptionsDatabase.address}`);

  const fixedRecurringPlans = await upgrades.deployProxy(
    FixedRecurringPlans,
    [fixedRecurringPlansDatabase.address, tokensRegistry.address]
  );

  const fixedRecurringSubscriptions = await upgrades.deployProxy(
    FixedRecurringSubscriptions,
    [fixedRecurringPlansDatabase.address, fixedRecurringSubscriptionsDatabase.address, transfers.address]
  );

  const fixedRecurringSubscriptionsManagement = await upgrades.deployProxy(
    FixedRecurringSubscriptionsManagement,
    [fixedRecurringPlansDatabase.address, fixedRecurringSubscriptionsDatabase.address, transfers.address]
  );

  await fixedRecurringPlans.deployed();
  await fixedRecurringSubscriptions.deployed();
  await fixedRecurringSubscriptionsManagement.deployed();

  console.log(`FixedRecurringPlans: ${fixedRecurringPlans.address}`);
  console.log(`FixedRecurringSubscriptions: ${fixedRecurringSubscriptions.address}`);
  console.log(`FixedRecurringSubscriptionsManagement: ${fixedRecurringSubscriptionsManagement.address}`);

  await fixedRecurringPlansDatabase.initAccessControl(
    [Role.OWNER, Role.NETWORK_CONTRACT],
    [multiSigWallet, fixedRecurringPlans.address]
  );

  await fixedRecurringSubscriptionsDatabase.initAccessControl(
    [Role.OWNER, Role.NETWORK_CONTRACT, Role.NETWORK_CONTRACT],
    [multiSigWallet, fixedRecurringSubscriptions.address, fixedRecurringSubscriptionsManagement.address]
  );

  /* Variable Recurring */
  const VariableRecurringPlans = await ethers.getContractFactory('VariableRecurringPlans');
  const VariableRecurringDatabase = await ethers.getContractFactory('VariableRecurringPlansDatabase');
  const VariableRecurringSubscriptions = await ethers.getContractFactory('VariableRecurringSubscriptions');
  const VariableRecurringSubscriptionsManagement = await ethers.getContractFactory('VariableRecurringSubscriptionsManagement');
  const VariableRecurringSubscriptionsDatabase = await ethers.getContractFactory('VariableRecurringSubscriptionsDatabase');

  const variableRecurringPlansDatabase = await upgrades.deployProxy(VariableRecurringDatabase);
  const variableRecurringSubscriptionsDatabase = await upgrades.deployProxy(VariableRecurringSubscriptionsDatabase);

  await variableRecurringPlansDatabase.deployed();
  await variableRecurringSubscriptionsDatabase.deployed();

  console.log(`VariableRecurringPlansDatabase: ${variableRecurringPlansDatabase.address}`);
  console.log(`VariableRecurringSubscriptionsDatabase: ${variableRecurringSubscriptionsDatabase.address}`);

  const variableRecurringPlans = await upgrades.deployProxy(
    VariableRecurringPlans,
    [variableRecurringPlansDatabase.address, tokensRegistry.address]
  );

  const variableRecurringSubscriptions = await upgrades.deployProxy(
    VariableRecurringSubscriptions,
    [variableRecurringPlansDatabase.address, variableRecurringSubscriptionsDatabase.address]
  );

  const variableRecurringSubscriptionsManagement = await upgrades.deployProxy(
    VariableRecurringSubscriptionsManagement,
    [variableRecurringPlansDatabase.address, variableRecurringSubscriptionsDatabase.address, transfers.address]
  );

  await variableRecurringPlans.deployed();
  await variableRecurringSubscriptions.deployed();
  await variableRecurringSubscriptionsManagement.deployed();

  console.log(`VariableRecurringPlans: ${variableRecurringPlans.address}`);
  console.log(`VariableRecurringSubscriptions: ${variableRecurringSubscriptions.address}`);
  console.log(`VariableRecurringSubscriptionsManagement: ${variableRecurringSubscriptionsManagement.address}`);

  await variableRecurringPlansDatabase.initAccessControl(
    [Role.OWNER, Role.NETWORK_CONTRACT],
    [multiSigWallet, variableRecurringPlans.address]
  );

  await variableRecurringSubscriptionsDatabase.initAccessControl(
    [Role.OWNER, Role.NETWORK_CONTRACT, Role.NETWORK_CONTRACT],
    [multiSigWallet, variableRecurringSubscriptions.address, variableRecurringSubscriptionsManagement.address]
  );

  /* On Demand */
  const OnDemandPlans = await ethers.getContractFactory('OnDemandPlans');
  const OnDemandDatabase = await ethers.getContractFactory('OnDemandPlansDatabase');
  const OnDemandSubscriptions = await ethers.getContractFactory('OnDemandSubscriptions');
  const OnDemandSubscriptionsManagement = await ethers.getContractFactory('OnDemandSubscriptionsManagement');
  const OnDemandSubscriptionsDatabase = await ethers.getContractFactory('OnDemandSubscriptionsDatabase');

  const onDemandPlansDatabase = await upgrades.deployProxy(OnDemandDatabase);
  const onDemandSubscriptionsDatabase = await upgrades.deployProxy(OnDemandSubscriptionsDatabase);

  await onDemandPlansDatabase.deployed();
  await onDemandSubscriptionsDatabase.deployed();

  console.log(`OnDemandPlansDatabase: ${onDemandPlansDatabase.address}`);
  console.log(`OnDemandSubscriptionsDatabase: ${onDemandSubscriptionsDatabase.address}`);

  const onDemandPlans = await upgrades.deployProxy(
    OnDemandPlans,
    [onDemandPlansDatabase.address, tokensRegistry.address]
  );

  const onDemandSubscriptions = await upgrades.deployProxy(
    OnDemandSubscriptions,
    [onDemandPlansDatabase.address, onDemandSubscriptionsDatabase.address]
  );

  const onDemandSubscriptionsManagement = await upgrades.deployProxy(
    OnDemandSubscriptionsManagement,
    [onDemandPlansDatabase.address, onDemandSubscriptionsDatabase.address, transfers.address]
  );

  await onDemandPlans.deployed();
  await onDemandSubscriptions.deployed();
  await onDemandSubscriptionsManagement.deployed();

  console.log(`OnDemandPlans: ${onDemandPlans.address}`);
  console.log(`OnDemandSubscriptions: ${onDemandSubscriptions.address}`);
  console.log(`OnDemandSubscriptionsManagement: ${onDemandSubscriptionsManagement.address}`);

  await onDemandPlansDatabase.initAccessControl(
    [Role.OWNER, Role.NETWORK_CONTRACT],
    [multiSigWallet, onDemandPlans.address]
  );

  await onDemandSubscriptionsDatabase.initAccessControl(
    [Role.OWNER, Role.NETWORK_CONTRACT, Role.NETWORK_CONTRACT],
    [multiSigWallet, onDemandSubscriptions.address, onDemandSubscriptionsManagement.address]
  );

  /* Setup Transfers access control */
  await transfers.initAccessControl(
    [
      Role.OWNER,
      Role.NETWORK_CONTRACT,
      Role.NETWORK_CONTRACT,
      Role.NETWORK_CONTRACT,
      Role.NETWORK_CONTRACT,
      Role.NETWORK_CONTRACT
    ],
    [
      multiSigWallet,
      oneTime.address,
      fixedRecurringSubscriptions.address,
      fixedRecurringSubscriptionsManagement.address,
      variableRecurringSubscriptionsManagement.address,
      onDemandSubscriptionsManagement.address
    ]
  );

  /* Transfer upgradability rights to multiSigWallet */
  upgrades.admin.transferProxyAdminOwnership(multiSigWallet);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
