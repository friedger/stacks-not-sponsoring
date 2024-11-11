import { addressToString, AuthType, ContractCallPayload, StacksTransactionWire } from '@stacks/transactions';

export const sponsoredContractsDeployer = 'SPP3HM2E4JXGT26G1QRWQ2YTR5WT040S5NKXZYFC';
export const sponsoredContracts = ['invaders-neon', 'stx-ft-swap', 'sub100neon-invader', 'neon-invader'];

const isValidNeonTransaction = (payload: ContractCallPayload) => {
	return (
		addressToString(payload.contractAddress) === sponsoredContractsDeployer &&
		sponsoredContracts.findIndex((n) => n === payload.contractName.content) >= 0
	);
};

export const isNeonSponsorable = (tx: StacksTransactionWire) => {
	return tx.auth.authType === AuthType.Sponsored && isValidNeonTransaction(tx.payload as ContractCallPayload);
};
