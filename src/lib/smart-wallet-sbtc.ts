import { AuthType, ContractCallPayload, PayloadType, StacksTransactionWire } from '@stacks/transactions';

export const isValidSmartWalletSBtcTransfer = (tx: StacksTransactionWire, feesInTokens: number, notSponsor: string) => {
	// expect contract call
	if (tx.payload.payloadType !== PayloadType.ContractCall) {
		console.log('not contract call');
		return { isSponsorable: false, data: { invalidPayloadType: tx.payload.payloadType } };
	}
	const payload = tx.payload as ContractCallPayload;
	return { isSponsorable: true, data: { feesInTokens } };
};
export const isSponsorable = (
	tx: StacksTransactionWire,
	feesInTokens: number,
	notSponsor: string
): { isSponsorable: boolean; data: any } => {
	return tx.auth.authType === AuthType.Sponsored
		? isValidSmartWalletSBtcTransfer(tx, feesInTokens, notSponsor)
		: { isSponsorable: false, data: { invalidAuthType: tx.auth.authType } };
};
