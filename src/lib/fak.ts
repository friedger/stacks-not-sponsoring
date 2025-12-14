import {
	addressToString,
	AuthType,
	ContractCallPayload,
	PayloadType,
	serializeAddress,
	serializeLPString,
	StacksTransactionWire,
} from '@stacks/transactions';

const SUPPORTED_CONTRACTS: string[] = [
	'SP6SA6BTPNN5WDAWQ7GWJF1T5E2KWY01K9SZDBJQ.pepe-faktory-pool-v2',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.b-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.leo-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.froggy-faktory-pool',
	'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-fakfun-amm-lp-v1',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.bob-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.pos-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.rapha-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.fakoon-faktory-dex',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.stxai-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.rock-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.skullcoin-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.shark-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.duke-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.peggy-faktory-pool',
	'SP3X75QCH10WGBECRBZR61NSKXV0VGZKPM29HH4NX.fair-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.droid-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.not-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.kangaroo-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.smoke-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.dgaf-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.nasty-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.andy-faktory-dex',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.aia-faktory-dex',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.bethresen-faktory-dex',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.play-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.birds-faktory-dex',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.nono-faktory-dex',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.flatearth-faktory-pool',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.buy-with-aibtc-faktory',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.buy-with-velar-faktory',
	'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.buy-with-btc-faktory',
];

const isValidFakTransaction = (tx: StacksTransactionWire) => {
	// expect contract call
	if (tx.payload.payloadType !== PayloadType.ContractCall) {
		console.log('not contract call');
		return { isSponsorable: false, data: { invalidPayloadType: tx.payload.payloadType } };
	}
	const payload = tx.payload as ContractCallPayload;
	const contractAddress = addressToString(payload.contractAddress);
	const contractName = payload.contractName.content;
	if (SUPPORTED_CONTRACTS.includes(`${contractAddress}.${contractName}`)) {
		return { isSponsorable: true, data: {} };
	}
	return { isSponsorable: false, data: { invalidContract: `${contractAddress}.${contractName}` } };
};
export const isSponsorable = (tx: StacksTransactionWire): { isSponsorable: boolean; data: any } => {
	return tx.auth.authType === AuthType.Sponsored
		? isValidFakTransaction(tx)
		: { isSponsorable: false, data: { invalidAuthType: tx.auth.authType } };
};
