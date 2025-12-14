import { StacksNetworkName } from '@stacks/network';
import { StacksTransactionWire, privateKeyToAddress, sponsorTransaction } from '@stacks/transactions';
import { get } from 'node:http';

export const sponsorTx = async (
	tx: StacksTransactionWire,
	network: StacksNetworkName,
	fee: number,
	sponsorNonce: number | undefined,
	sponsorIndex: number,
	env: Env
) => {
	const sponsorPrivateKey = getSponsorPrivateKey(env, sponsorIndex);
	return sponsorTransaction({
		sponsorPrivateKey,
		transaction: tx,
		network,
		fee,
		sponsorNonce,
	});
};

const getSponsorPrivateKey = (env: Env, sponsorIndex: number) => {
	return env.SPONSOR_PRIVATE_KEY_ARRAY ? env.SPONSOR_PRIVATE_KEY_ARRAY[sponsorIndex] || env.SPONSOR_PRIVATE_KEY : env.SPONSOR_PRIVATE_KEY;
};

export const getSponsorAddress = (env: Env, sponsorIndex: number) => {
	const sponsorPrivateKey = getSponsorPrivateKey(env, sponsorIndex);
	return privateKeyToAddress(sponsorPrivateKey, 'mainnet');
};
