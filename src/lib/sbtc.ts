import {
	AuthType,
	ContractCallPayload,
	ListCV,
	PayloadType,
	PrincipalCV,
	StacksTransactionWire,
	TupleCV,
	UIntCV,
	addressToString,
} from '@stacks/transactions';
import { MINIMUM_SBTC_SATS_FEES, SBTC_CONTRACT } from './const';

export const isValidSendManySbtc = (tx: StacksTransactionWire, feesInTokens: number, notSponsor: string) => {
	// expect contract call
	if (tx.payload.payloadType !== PayloadType.ContractCall) {
		console.log('not contract call');
		return { isSponsorable: false, data: { invalidPayloadType: tx.payload.payloadType } };
	}
	const payload = tx.payload as ContractCallPayload;
	// expect send many call
	if (
		addressToString(payload.contractAddress) !== SBTC_CONTRACT.contractAddress ||
		payload.contractName.content !== SBTC_CONTRACT.contractName ||
		payload.functionName.content !== SBTC_CONTRACT.functionName
	) {
		console.log('not correct contract');
		return { isSponsorable: false, data: { invalidContract: payload } };
	}
	// expect receiver entry for sponsor
	const receivers = payload.functionArgs[0] as ListCV<TupleCV<{ amount: UIntCV; to: PrincipalCV }>>;
	const sponsorEntry = receivers.value.find((r) => r.value.to.value === notSponsor);
	if (!sponsorEntry) {
		console.log(`not paying fees to ${notSponsor}`);
		return { isSponsorable: false, data: { noSponsorEntry: true } };
	}
	// expect at least minimum fee amount
	const amountForSponsor = Number(sponsorEntry.value.amount.value);
	if (amountForSponsor < MINIMUM_SBTC_SATS_FEES) {
		console.log('not paying enough fees');
		return { isSponsorable: false, data: { notEnoughFees: amountForSponsor } };
	}
	if (amountForSponsor !== feesInTokens) {
		console.log('not paying fees as specified');
		return { isSponsorable: false, data: { amountForSponsor, feesInTokens } };
	}
	return { isSponsorable: true, data: { amountForSponsor, feesInTokens } };
};
export const isSponsorable = (
	tx: StacksTransactionWire,
	feesInTokens: number,
	notSponsor: string
): { isSponsorable: boolean; data: any } => {
	return tx.auth.authType === AuthType.Sponsored
		? isValidSendManySbtc(tx, feesInTokens, notSponsor)
		: { isSponsorable: false, data: { invalidAuthType: tx.auth.authType } };
};
