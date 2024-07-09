// test/index.spec.ts
import { bytesToHex } from '@stacks/common';
import { StacksMainnet } from '@stacks/network';
import {
	AddressHashMode,
	AnchorMode,
	PostConditionMode,
	StacksTransaction,
	TransactionVersion,
	TupleCV,
	createSingleSigSpendingCondition,
	createSponsoredAuth,
	getAddressFromPrivateKey,
	listCV,
	makeContractCall,
	principalCV,
	tupleCV,
	uintCV,
} from '@stacks/transactions';
import { createContractCallPayload } from '@stacks/transactions/dist/payload';
import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { MINIMUM_NOT_FEES, SEND_MANY_NOT_CONTRACT } from '../src/lib/const';
import { isNeonSponsorable, sponsoredContracts, sponsoredContractsDeployer } from '../src/lib/neon';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const privateKey = '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601'; // from devnet toml
const NOT_SPONSOR = getAddressFromPrivateKey(privateKey, TransactionVersion.Mainnet); // SP1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRCBGD7R
const sendSendMany = async (receivers: TupleCV[], feesInNot: number) => {
	const { contractAddress, contractName, functionName } = SEND_MANY_NOT_CONTRACT;
	const tx = await makeContractCall({
		contractAddress,
		contractName,
		functionName,
		functionArgs: [listCV(receivers)],
		senderKey: privateKey,
		nonce: 0,
		fee: 0,
		network: new StacksMainnet(),
		sponsored: true,
		postConditionMode: PostConditionMode.Allow,
		anchorMode: AnchorMode.Any,
	});
	const txHex = bytesToHex(tx.serialize());
	const request = new IncomingRequest('http://localhost/not', {
		body: JSON.stringify({
			txHex,
			network: 'mainnet',
			feesInNot,
		}),
		headers: {
			'content-type': 'text/plain',
		},
		method: 'POST',
	});
	// Create an empty context to pass to `worker.fetch()`.
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
	await waitOnExecutionContext(ctx);
	return response;
};

describe('Sponsoring worker - NOT', () => {
	it('responds with sponsored transaction', async () => {
		const feesInNot = MINIMUM_NOT_FEES;
		const receivers = [
			tupleCV({ to: principalCV('SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'), amount: uintCV(100) }),
			tupleCV({ to: principalCV(NOT_SPONSOR), amount: uintCV(feesInNot) }),
		];
		const response = await sendSendMany(receivers, feesInNot);
		const result = ((await response.json()) as any).result;
		expect(result).toHaveProperty('error', 'transaction rejected');
		expect(result).toHaveProperty('reason', 'FeeTooLow');
	});

	it('responds with sponsored transaction if sponsor is not last', async () => {
		const feesInNot = MINIMUM_NOT_FEES;
		const receivers = [
			tupleCV({ to: principalCV(NOT_SPONSOR), amount: uintCV(feesInNot) }),
			tupleCV({ to: principalCV('SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'), amount: uintCV(100) }),
		];
		const response = await sendSendMany(receivers, feesInNot);
		const result = ((await response.json()) as any).result;
		expect(result).toHaveProperty('error', 'transaction rejected');
		expect(result).toHaveProperty('reason', 'FeeTooLow');
	});
	it('responds with error if fees are too low', async () => {
		const feesInNot = MINIMUM_NOT_FEES - 1;
		const receivers = [
			tupleCV({ to: principalCV(NOT_SPONSOR), amount: uintCV(feesInNot) }),
			tupleCV({ to: principalCV('SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'), amount: uintCV(100) }),
		];
		const response = await sendSendMany(receivers, feesInNot);
		expect(await response.text()).toMatchInlineSnapshot(`"{"error":"not sponsorable"}"`);
	});
	it('responds with error if not entry for sponsor', async () => {
		const feesInNot = MINIMUM_NOT_FEES - 1;
		const receivers = [tupleCV({ to: principalCV('SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'), amount: uintCV(100) })];
		const response = await sendSendMany(receivers, feesInNot);
		expect(await response.text()).toMatchInlineSnapshot(`"{"error":"not sponsorable"}"`);
	});
});

describe('Sponsoring worker - Neon', () => {
	it('accepts only supported contracts', () => {
		const tx = new StacksTransaction(
			TransactionVersion.Mainnet,
			createSponsoredAuth(createSingleSigSpendingCondition(AddressHashMode.SerializeP2PKH, '', 0, 1000)),
			createContractCallPayload(sponsoredContractsDeployer, sponsoredContracts[0], 'test', [])
		);
		expect(isNeonSponsorable(tx)).toBeTruthy();
	});
});
describe('Sponsoring worker - Status', () => {
	it('responds with status', async () => {
		const request = new IncomingRequest('http://localhost/status', {
			headers: {
				'content-type': 'text/plain',
			},
			method: 'GET',
		});
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toMatchInlineSnapshot(`"{"fees":{"not":100000,"sponsor":"SP1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRCBGD7R"}}"`);
	});
});
