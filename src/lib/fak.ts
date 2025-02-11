import {
	AuthType,
	ContractCallPayload,
	PayloadType,
	serializeAddress,
	serializeLPString,
	StacksTransactionWire,
} from '@stacks/transactions';

const isValidFakTransaction = (tx: StacksTransactionWire, notSponsor: string) => {
	// expect contract call
	if (tx.payload.payloadType !== PayloadType.ContractCall) {
		console.log('not contract call');
		return { isSponsorable: false, data: { invalidPayloadType: tx.payload.payloadType } };
	}
	const payload = tx.payload as ContractCallPayload;
	const contractAddress = serializeAddress(payload.contractAddress);
	const contractName = serializeLPString(payload.contractName);
	if (
		contractAddress === 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22' &&
		(contractName === 'buy-with-aibtc-faktory' || contractName === 'buy-with-velar-faktory' || contractName === 'buy-with-btc-faktory')
	) {
		return { isSponsorable: true, data: {} };
	}
	return { isSponsorable: false, data: { invalidContract: `${contractAddress}.${contractName}` } };
};
export const isSponsorable = (tx: StacksTransactionWire, notSponsor: string): { isSponsorable: boolean; data: any } => {
	return tx.auth.authType === AuthType.Sponsored
		? isValidFakTransaction(tx, notSponsor)
		: { isSponsorable: false, data: { invalidAuthType: tx.auth.authType } };
};
