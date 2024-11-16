import { StacksNetworkName } from '@stacks/network';
import { StacksTransactionWire, sponsorTransaction } from '@stacks/transactions';

export const sponsorTx = async (
	tx: StacksTransactionWire,
	network: StacksNetworkName,
	fee: number,
	sponsorNonce: number | undefined,
	env: Env
) => {
	return sponsorTransaction({
		sponsorPrivateKey: env.SPONSOR_PRIVATE_KEY,
		transaction: tx,
		network,
		fee,
		sponsorNonce,
	});
};
