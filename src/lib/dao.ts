import { StacksNetworkName } from '@stacks/network';
import { AuthType, StacksTransactionWire } from '@stacks/transactions';

export const isValidDaoTransaction = (tx: StacksTransactionWire, daoDeployer: string, network: StacksNetworkName) => {
	const spendingCondition = tx.auth.spendingCondition;
	const signer = spendingCondition?.signer;
	const validSigner = network === 'testnet' || signer === daoDeployer;
	if (!validSigner) {
		return { isSponsorable: false, data: { invalidSigner: signer } };
	}
	return { isSponsorable: true, data: { signer } };
};
export const isSponsorable = (
	tx: StacksTransactionWire,
	daoDeployer: string,
	network: StacksNetworkName
): { isSponsorable: boolean; data: any } => {
	return tx.auth.authType === AuthType.Sponsored
		? isValidDaoTransaction(tx, daoDeployer, network)
		: { isSponsorable: false, data: { invalidAuthType: tx.auth.authType } };
};
