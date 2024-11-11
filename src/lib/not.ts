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
	deserializeTransaction,
} from '@stacks/transactions';
import { MINIMUM_NOT_FEES, SEND_MANY_NOT_CONTRACT } from './const';
import { Details } from './helpers';

const getFeesInNot = (feesInNot: number | string) => {
	if (typeof feesInNot === 'number') {
		return feesInNot;
	}
	try {
		return parseInt(feesInNot);
	} catch (e) {}
	return undefined;
};

export const extractDetails = async (requestBody: any): Promise<Partial<Details>> => {
	const network = requestBody.network;
	if (requestBody.txHex && network && requestBody.feesInNot) {
		const feesInNot = getFeesInNot(requestBody.feesInNot);
		try {
			const tx = deserializeTransaction(requestBody.txHex);
			return { tx, network, feesInNot };
		} catch (e) {
			return { error: 'Invalid txHex' };
		}
	}

	return { error: 'expected {txHex: string; network: StacksNetworkName; feesInNot: number }' };
};

export const isValidSendManyNot = (tx: StacksTransactionWire, feesInNot: number, notSponsor: string) => {
	// expect contract call
	if (tx.payload.payloadType !== PayloadType.ContractCall) {
		console.log('not contract call');
		return false;
	}
	const payload = tx.payload as ContractCallPayload;
	// expect send many call
	if (
		addressToString(payload.contractAddress) !== SEND_MANY_NOT_CONTRACT.contractAddress ||
		payload.contractName.content !== SEND_MANY_NOT_CONTRACT.contractName ||
		payload.functionName.content !== SEND_MANY_NOT_CONTRACT.functionName
	) {
		console.log('not correct contract');
		return false;
	}
	// expect receiver entry for sponsor
	const receivers = payload.functionArgs[0] as ListCV<TupleCV<{ amount: UIntCV; to: PrincipalCV }>>;
	const sponsorEntry = receivers.value.find((r) => r.value.to.value === notSponsor);
	if (!sponsorEntry) {
		console.log(`not paying fees to ${notSponsor}`);
		return false;
	}
	// expect at least minimum fee amount
	const amountForSponsor = Number(sponsorEntry.value.amount.value);
	if (amountForSponsor < MINIMUM_NOT_FEES) {
		console.log('not paying enough fees');
		return false;
	}
	if (amountForSponsor !== feesInNot) {
		console.log('not paying fees as specified');
		return false;
	}
	return true;
};
export const isSponsorable = (tx: StacksTransactionWire, feesInNot: number, notSponsor: string) => {
	return tx.auth.authType === AuthType.Sponsored && isValidSendManyNot(tx, feesInNot, notSponsor);
};
