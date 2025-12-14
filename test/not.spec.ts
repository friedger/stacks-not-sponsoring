import { StacksNetworkName } from '@stacks/network';
import { Cl, PostConditionMode, TupleCV, getAddressFromPrivateKey, makeContractCall } from '@stacks/transactions';
import { describe, expect, it } from 'vitest';
import { MINIMUM_NOT_FEES, SEND_MANY_NOT_CONTRACT } from '../src/lib/const';
import { isSponsorable } from '../src/lib/not';

const network: StacksNetworkName = 'mainnet';

const privateKey = '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601';
const NOT_SPONSOR = getAddressFromPrivateKey(privateKey, network);

const createSendManyTx = async (receivers: TupleCV[]) => {
	const { contractAddress, contractName, functionName } = SEND_MANY_NOT_CONTRACT;
	const tx = await makeContractCall({
		contractAddress,
		contractName,
		functionName,
		functionArgs: [Cl.list(receivers)],
		senderKey: privateKey,
		nonce: 0,
		fee: 0,
		network,
		sponsored: true,
		postConditionMode: PostConditionMode.Allow,
	});
	return tx;
};

describe('NOT sponsoring', () => {
	it('is sponsorable with valid fees', async () => {
		const feesInNot = MINIMUM_NOT_FEES;
		const receivers = [
			Cl.tuple({ to: Cl.principal('SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'), amount: Cl.uint(100) }),
			Cl.tuple({ to: Cl.principal(NOT_SPONSOR), amount: Cl.uint(feesInNot) }),
		];
		const tx = await createSendManyTx(receivers);
		const result = isSponsorable(tx, feesInNot, NOT_SPONSOR);
		expect(result.isSponsorable).toBe(true);
	});

	it('is sponsorable if sponsor is not last', async () => {
		const feesInNot = MINIMUM_NOT_FEES;
		const receivers = [
			Cl.tuple({ to: Cl.principal(NOT_SPONSOR), amount: Cl.uint(feesInNot) }),
			Cl.tuple({ to: Cl.principal('SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'), amount: Cl.uint(100) }),
		];
		const tx = await createSendManyTx(receivers);
		const result = isSponsorable(tx, feesInNot, NOT_SPONSOR);
		expect(result.isSponsorable).toBe(true);
	});

	it('is not sponsorable if fees are too low', async () => {
		const feesInNot = MINIMUM_NOT_FEES - 1;
		const receivers = [
			Cl.tuple({ to: Cl.principal(NOT_SPONSOR), amount: Cl.uint(feesInNot) }),
			Cl.tuple({ to: Cl.principal('SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'), amount: Cl.uint(100) }),
		];
		const tx = await createSendManyTx(receivers);
		const result = isSponsorable(tx, feesInNot, NOT_SPONSOR);
		expect(result.isSponsorable).toBe(false);
	});

	it('is not sponsorable if no entry for sponsor', async () => {
		const feesInNot = MINIMUM_NOT_FEES;
		const receivers = [Cl.tuple({ to: Cl.principal('SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'), amount: Cl.uint(100) })];
		const tx = await createSendManyTx(receivers);
		const result = isSponsorable(tx, feesInNot, NOT_SPONSOR);
		expect(result.isSponsorable).toBe(false);
	});
});
