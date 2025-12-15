import { StacksNetworkName } from '@stacks/network';
import { Cl, PostConditionMode, TupleCV, getAddressFromPrivateKey, makeContractCall } from '@stacks/transactions';
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { MINIMUM_NOT_FEES, SEND_MANY_NOT_CONTRACT } from '../src/lib/const';

const network: StacksNetworkName = 'mainnet';

const privateKey = '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601'; // from devnet toml
const NOT_SPONSOR = getAddressFromPrivateKey(privateKey, network); // SP1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRCBGD7R

const sendSendMany = async (receivers: TupleCV[], feesInNot: number) => {
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
	const txHex = tx.serialize();

	const response = await SELF.fetch('http://localhost/not/v1/sponsor', {
		body: JSON.stringify({
			tx: txHex,
			network: 'mainnet',
			feesInTokens: feesInNot,
		}),
		headers: {
			'content-type': 'application/json',
		},
		method: 'POST',
	});

	return response;
};

describe('Sponsoring worker - NOT', () => {
	it('responds with sponsored transaction', async () => {
		const feesInNot = MINIMUM_NOT_FEES;
		const receivers = [
			Cl.tuple({ to: Cl.principal('SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'), amount: Cl.uint(100) }),
			Cl.tuple({ to: Cl.principal(NOT_SPONSOR), amount: Cl.uint(feesInNot) }),
		];
		const response = await sendSendMany(receivers, feesInNot);
		const result = (await response.json()) as any;

		expect(result.error).toHaveProperty('error', 'transaction rejected');
		expect(result.error).toHaveProperty('reason', 'FeeTooLow');
	});

	it('responds with sponsored transaction if sponsor is not last', async () => {
		const feesInNot = MINIMUM_NOT_FEES;
		const receivers = [
			Cl.tuple({ to: Cl.principal(NOT_SPONSOR), amount: Cl.uint(feesInNot) }),
			Cl.tuple({ to: Cl.principal('SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'), amount: Cl.uint(100) }),
		];
		const response = await sendSendMany(receivers, feesInNot);
		const result = (await response.json()) as any;
		expect(result.error).toHaveProperty('error', 'transaction rejected');
		expect(result.error).toHaveProperty('reason', 'FeeTooLow');
	});

	it('responds with error if fees are too low', async () => {
		const feesInNot = MINIMUM_NOT_FEES - 1;
		const receivers = [
			Cl.tuple({ to: Cl.principal(NOT_SPONSOR), amount: Cl.uint(feesInNot) }),
			Cl.tuple({ to: Cl.principal('SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'), amount: Cl.uint(100) }),
		];
		const response = await sendSendMany(receivers, feesInNot);
		expect(await response.text()).toMatchInlineSnapshot(
			`"{"isSponsorable":false,"error":"not sponsorable","errorData":{"notEnoughFees":9999}}"`
		);
	});

	it('responds with error if not entry for sponsor', async () => {
		const feesInNot = MINIMUM_NOT_FEES - 1;
		const receivers = [Cl.tuple({ to: Cl.principal('SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ'), amount: Cl.uint(100) })];
		const response = await sendSendMany(receivers, feesInNot);
		const result = await response.json();
		expect(result.error).toBe('not sponsorable');
	});
});

describe('Sponsoring worker - Status', () => {
	it('responds with status', async () => {
		const response = await SELF.fetch('http://localhost/not/v1/info', {
			headers: {
				'content-type': 'text/plain',
			},
			method: 'GET',
		});
		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.active).toBe(true);
		expect(result.sponsor_addresses).toContain(NOT_SPONSOR);
		expect(result.fees).toEqual({ not: MINIMUM_NOT_FEES, sponsor: [NOT_SPONSOR] });
	});
});

describe('Sponsoring worker - http errors', () => {
	it('responds with error for invalid POST to /not', async () => {
		const response = await SELF.fetch('http://localhost/not/v1/sponsor', {
			body: JSON.stringify({
				tx: 'invalid',
				network: 'mainnet',
				feesInNot: 100000,
			}),
			headers: {
				'content-type': 'application/json',
			},
			method: 'POST',
		});
		expect(response.status).toBe(400);
	});

	it('responds with 405 for unsupported methods', async () => {
		const response = await SELF.fetch('http://localhost/status', {
			method: 'PUT',
		});
		expect(response.status).toBe(405);
	});
});
