import { describe, expect, it } from 'vitest';
import { makeContractCall, getAddressFromPrivateKey, PostConditionMode } from '@stacks/transactions';
import { isSponsorable } from '../src/lib/fak';

const privateKey = '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601';
const notSponsor = getAddressFromPrivateKey(privateKey, 'mainnet');

describe('Fak sponsoring', () => {
	describe('isSponsorable', () => {
		it('should accept supported contract calls', async () => {
			const tx = await makeContractCall({
				contractAddress: 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22',
				contractName: 'b-faktory-pool',
				functionName: 'swap',
				functionArgs: [],
				senderKey: privateKey,
				sponsored: true,
				fee: 0,
				nonce: 0,
				network: 'mainnet',
				postConditionMode: PostConditionMode.Allow,
			});

			const result = isSponsorable(tx);
			expect(result.isSponsorable).toBe(true);
		});

		it('should accept pepe-faktory-pool-v2 contract', async () => {
			const tx = await makeContractCall({
				contractAddress: 'SP6SA6BTPNN5WDAWQ7GWJF1T5E2KWY01K9SZDBJQ',
				contractName: 'pepe-faktory-pool-v2',
				functionName: 'swap',
				functionArgs: [],
				senderKey: privateKey,
				sponsored: true,
				fee: 0,
				nonce: 0,
				network: 'mainnet',
				postConditionMode: PostConditionMode.Allow,
			});

			const result = isSponsorable(tx);
			expect(result.isSponsorable).toBe(true);
		});

		it('should reject unsupported contract address', async () => {
			const tx = await makeContractCall({
				contractAddress: 'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ',
				contractName: 'b-faktory-pool',
				functionName: 'swap',
				functionArgs: [],
				senderKey: privateKey,
				sponsored: true,
				fee: 0,
				nonce: 0,
				network: 'mainnet',
				postConditionMode: PostConditionMode.Allow,
			});

			const result = isSponsorable(tx);
			expect(result.isSponsorable).toBe(false);
			expect(result.data).toHaveProperty('invalidContract');
		});

		it('should reject unsupported contract name', async () => {
			const tx = await makeContractCall({
				contractAddress: 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22',
				contractName: 'unsupported-contract',
				functionName: 'swap',
				functionArgs: [],
				senderKey: privateKey,
				sponsored: true,
				fee: 0,
				nonce: 0,
				network: 'mainnet',
				postConditionMode: PostConditionMode.Allow,
			});

			const result = isSponsorable(tx);
			expect(result.isSponsorable).toBe(false);
			expect(result.data).toHaveProperty('invalidContract');
		});

		it('should reject non-sponsored transactions', async () => {
			const tx = await makeContractCall({
				contractAddress: 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22',
				contractName: 'b-faktory-pool',
				functionName: 'swap',
				functionArgs: [],
				senderKey: privateKey,
				sponsored: false,
				fee: 1000,
				nonce: 0,
				network: 'mainnet',
				postConditionMode: PostConditionMode.Allow,
			});

			const result = isSponsorable(tx);
			expect(result.isSponsorable).toBe(false);
			expect(result.data).toHaveProperty('invalidAuthType');
		});

		it('should accept sbtc-fakfun-amm-lp-v1 contract', async () => {
			const tx = await makeContractCall({
				contractAddress: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
				contractName: 'sbtc-fakfun-amm-lp-v1',
				functionName: 'swap',
				functionArgs: [],
				senderKey: privateKey,
				sponsored: true,
				fee: 0,
				nonce: 0,
				network: 'mainnet',
				postConditionMode: PostConditionMode.Allow,
			});

			const result = isSponsorable(tx);
			expect(result.isSponsorable).toBe(true);
		});
	});
});
