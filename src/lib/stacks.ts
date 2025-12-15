import { StacksNetworkName } from '@stacks/network';
import { StacksTransactionWire, privateKeyToAddress, sponsorTransaction } from '@stacks/transactions';

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
	const sponsorKeys: string[] = env.SPONSOR_PRIVATE_KEY_CSV.split(',');
	return sponsorKeys.length > 0 ? sponsorKeys[sponsorIndex] || env.SPONSOR_PRIVATE_KEY : env.SPONSOR_PRIVATE_KEY;
};

export const getSponsorAddress = (env: Env, sponsorIndex: number) => {
	const sponsorPrivateKey = getSponsorPrivateKey(env, sponsorIndex);
	return privateKeyToAddress(sponsorPrivateKey, 'mainnet');
};
