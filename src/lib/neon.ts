import { addressToString, AuthType, ContractCallPayload, StacksTransactionWire } from '@stacks/transactions';

export const sponsoredContractsDeployer = 'SPP3HM2E4JXGT26G1QRWQ2YTR5WT040S5NKXZYFC';
export const sponsoredContracts = ['invaders-neon', 'stx-ft-swap', 'sub100neon-invader', 'neon-invader'];

const isValidNeonTransaction = (payload: ContractCallPayload) => {
	if (
		addressToString(payload.contractAddress) === sponsoredContractsDeployer &&
		sponsoredContracts.findIndex((n) => n === payload.contractName.content) >= 0
	) {
		return {
			isSponsorable: true,
			data: { contractAddress: addressToString(payload.contractAddress), contractName: payload.contractName.content },
		};
	} else {
		return {
			isSponsorable: false,
			data: { invalidContract: `${addressToString(payload.contractAddress)}.${payload.contractName.content}` },
		};
	}
};

export const isNeonSponsorable = (tx: StacksTransactionWire): { isSponsorable: boolean; data: any } => {
	return tx.auth.authType === AuthType.Sponsored
		? isValidNeonTransaction(tx.payload as ContractCallPayload)
		: { isSponsorable: false, data: { invalidAuthType: tx.auth.authType } };
};
