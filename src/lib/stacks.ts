import { StacksMainnet, StacksNetwork, StacksNetworkName } from '@stacks/network';
import {
	AuthType,
	ContractCallPayload,
	ListCV,
	PayloadType,
	PrincipalCV,
	StacksTransaction,
	TupleCV,
	UIntCV,
	addressToString,
	deserializeTransaction,
	sponsorTransaction,
} from '@stacks/transactions';
import { MINIMUM_NOT_FEES, SEND_MANY_NOT_CONTRACT } from './const';

export type Details = {
	error: string;
	tx: StacksTransaction;
	network: StacksNetwork;
	feesInNot: number;
};

const getNetwork = (networkName: StacksNetworkName) => {
	switch (networkName) {
		case 'mainnet':
			return new StacksMainnet();
			break;
		case 'testnet':
			return new StacksNetwork({
				url: 'https://example.com',
				fetchFn: async () => {
					return new Response();
				},
			});
		default:
			return undefined;
	}
};

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
	const network = getNetwork(requestBody.network);
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

export const isValidSendManyNot = (tx: StacksTransaction, feesInNot: number, notSponsor: string) => {
	// expect contract call
	if (tx.payload.payloadType !== PayloadType.ContractCall) {
		return false;
	}
	const payload = tx.payload as ContractCallPayload;
	// expect send many call
	if (
		addressToString(payload.contractAddress) !== SEND_MANY_NOT_CONTRACT.contractAddress ||
		payload.contractName.content !== SEND_MANY_NOT_CONTRACT.contractName ||
		payload.functionName.content !== SEND_MANY_NOT_CONTRACT.functionName
	) {
		return false;
	}
	// expect receiver entry for sponsor
	const receivers = payload.functionArgs[0] as ListCV<TupleCV<{ amount: UIntCV; to: PrincipalCV }>>;
	const sponsorEntry = receivers.list.find((r) => addressToString(r.data['to'].address) === notSponsor);
	if (!sponsorEntry) {
		return false;
	}
	// expect at least minimum fee amount
	const amountForSponsor = Number(sponsorEntry.data.amount.value);
	if (amountForSponsor < MINIMUM_NOT_FEES) {
		return false;
	}
	if (amountForSponsor !== feesInNot) {
		return false;
	}
	return true;
};
export const isSponsorable = (tx: StacksTransaction, feesInNot: number, notSponsor: string) => {
	return tx.auth.authType === AuthType.Sponsored && isValidSendManyNot(tx, feesInNot, notSponsor);
};

export const sponsorTx = async (tx: StacksTransaction, network: StacksNetwork, fee: number, sponsorNonce: number | undefined, env: Env) => {
	return sponsorTransaction({
		sponsorPrivateKey: env.SPONSOR_PRIVATE_KEY,
		transaction: tx,
		network,
		fee,
		sponsorNonce,
	});
};
