/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { getFetchOptions } from '@stacks/common';
import { StacksNetworkName } from '@stacks/network';
import {
	broadcastTransaction,
	deserializeTransaction,
	estimateTransactionByteLength,
	fetchFeeEstimateTransaction,
	privateKeyToAddress,
	serializePayload,
	StacksTransactionWire,
	transactionToHex,
} from '@stacks/transactions';
import { MAX_FEE, MINIMUM_NOT_FEES } from './lib/const';
import { isSponsorable as isDaoSponsorable } from './lib/dao';
import { isSponsorable as isFakSponsorable } from './lib/fak';
import { Details, extractDetails, readRequestBody, RequestBody, responseError } from './lib/helpers';
import { isNeonSponsorable } from './lib/neon';
import { isSponsorable as isNotSponsorable } from './lib/not';
import { isSponsorable as isSbtcSponsorable } from './lib/sbtc';
import { isSponsorable as isSmartWalletSBtcSponsorable } from './lib/smart-wallet-sbtc';
import { sponsorTx } from './lib/stacks';
import { SponsorManagement } from './sponsorManagement';

const opts = getFetchOptions() as Record<string, unknown>;
delete opts.referrerPolicy;

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'POST') {
			const reqBody = await readRequestBody(request);
			if (!reqBody) {
				return responseError('missing request body');
			}
			if (url.pathname === '/not/v1/sponsor') {
				return this.sponsorNotTransaction(reqBody, env);
			}
			if (url.pathname === '/neon/v1/sponsor') {
				return this.sponsorNeonTransaction(reqBody, env);
			}
			if (url.pathname === '/sbtc/v1/sponsor') {
				return this.sponsorSbtcTransaction(reqBody, env);
			}
			if (url.pathname === '/fak/v1/sponsor') {
				return this.sponsorFakTransaction(reqBody, env);
			}
			if (url.pathname === '/smart-wallet-sbtc/v1/sponsor') {
				return this.sponsorSmartWalletSBtcTransaction(reqBody, env);
			}
			if (url.pathname === '/dao/v1/sponsor') {
				return this.sponsorDaoTransactions(reqBody, env);
			}

			return Response.json(
				{
					error: 'unsupported url. try not/v1/info instead of ' + url.pathname,
				},
				{ status: 404 }
			);
		} else if (request.method === 'GET') {
			if (url.pathname === '/not/v1/info' || url.pathname === '/neon/v1/info') {
				return this.getInfo(env);
			}
			return Response.json(
				{
					error: 'unsupported url. try not/v1/info instead of ' + url.pathname,
				},
				{ status: 404 }
			);
		} else {
			return Response.json(
				{
					error: 'unsupported http method',
				},
				{ status: 405 }
			);
		}
	},

	async signAndBroadcastTransaction(
		sponsoringCheck: (reqBody: Partial<Details>) => { isSponsorable: boolean; data: any },
		reqBody: Partial<RequestBody>,
		env: Env
	) {
		// Get sponsor management durable object
		const sponsorManagement = getSponsorManagement(env);

		let sponsorIndex: number | undefined;
		let sponsorNonce: number | undefined;

		try {
			// get tx from request
			const details = await extractDetails(reqBody);

			if (details.error) {
				return responseError(details.error);
			}
			const { tx, network, feesInTokens } = details;

			if (!tx || !network || !feesInTokens) {
				return responseError('invalid request, valid tx? ' + !tx + ' valid network? ' + !network + ' valid feesInTokens? ' + !feesInTokens);
			}
			const sponsorableCheckResult = sponsoringCheck(details);
			if (!sponsorableCheckResult.isSponsorable) {
				return Response.json(
					{
						isSponsorable: false,
						error: 'not sponsorable',
						errorData: sponsorableCheckResult.data,
					},
					{ status: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
				);
			}

			// Get next nonce from sponsor management
			// const nonceResult = await sponsorManagement.getSponsorNonce();
			sponsorIndex = 0; //nonceResult.sponsorIndex;
			sponsorNonce = undefined;

			const feeEstimate = await estimateFee(tx, network);
			const sponsoredTx = await sponsorTx(tx, network, Number(env.DEV === 'true' ? 0 : feeEstimate), sponsorNonce, sponsorIndex, env);
			const result = await broadcastTransaction({ transaction: sponsoredTx, network });

			if ('error' in result) {
				if (sponsorNonce !== undefined) {
					// Update nonce as unused (return it to the pool)
					await sponsorManagement.updateNonce(sponsorIndex, sponsorNonce, undefined);
				}
				return Response.json(
					{
						tx: (reqBody as any).tx,
						error: result,
					},
					{ status: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
				);
			} else {
				if (sponsorNonce !== undefined) {
					// Update nonce as used (mark with txid)
					await sponsorManagement.updateNonce(sponsorIndex, sponsorNonce, result.txid);
				}
				return Response.json(
					{
						txid: result.txid,
						rawTx: transactionToHex(sponsoredTx),
						feeEstimate,
						result,
					},
					{ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
				);
			}
		} catch (e) {
			console.log(e);

			// If we reserved a nonce but failed, return it to the pool
			if (sponsorIndex !== undefined && sponsorNonce !== undefined) {
				try {
					await sponsorManagement.updateNonce(sponsorIndex, sponsorNonce, undefined);
				} catch (updateError) {
					console.log('Failed to return nonce to pool:', updateError);
				}
			}

			return Response.json(
				{
					txHex: (reqBody as any).tx,
					txHex2: transactionToHex(deserializeTransaction((reqBody as any).tx)),
					error: 'exception ' + e,
				},
				{ status: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
			);
		}
	},

	async sponsorNotTransaction(reqBody: Partial<RequestBody>, env: Env) {
		return this.signAndBroadcastTransaction(
			({ tx, feesInTokens, network }: Partial<Details>) =>
				tx !== undefined && feesInTokens !== undefined && network !== undefined
					? isNotSponsorable(tx, feesInTokens, privateKeyToAddress(env.SPONSOR_PRIVATE_KEY, network))
					: {
							isSponsorable: false,
							data: reqBody,
					  },
			reqBody,
			env
		);
	},

	async sponsorNeonTransaction(reqBody: Partial<RequestBody>, env: Env) {
		return this.signAndBroadcastTransaction(
			({ tx }: Partial<Details>) =>
				tx !== undefined
					? isNeonSponsorable(tx)
					: {
							isSponsorable: false,
							data: reqBody,
					  },
			reqBody,
			env
		);
	},

	async sponsorSbtcTransaction(reqBody: Partial<RequestBody>, env: Env) {
		return this.signAndBroadcastTransaction(
			({ tx, feesInTokens, network }: Partial<Details>) =>
				tx !== undefined && feesInTokens !== undefined && network !== undefined
					? isSbtcSponsorable(tx, feesInTokens, privateKeyToAddress(env.SPONSOR_PRIVATE_KEY, network))
					: {
							isSponsorable: false,
							data: reqBody,
					  },
			reqBody,
			env
		);
	},

	async sponsorFakTransaction(reqBody: Partial<RequestBody>, env: Env) {
		return this.signAndBroadcastTransaction(
			({ tx, feesInTokens, network }: Partial<Details>) =>
				tx !== undefined && network !== undefined
					? isFakSponsorable(tx)
					: {
							isSponsorable: false,
							data: reqBody,
					  },
			reqBody,
			env
		);
	},

	async sponsorSmartWalletSBtcTransaction(reqBody: Partial<RequestBody>, env: Env) {
		return this.signAndBroadcastTransaction(
			({ tx, feesInTokens, network }: Partial<Details>) =>
				tx !== undefined && network !== undefined && feesInTokens !== undefined
					? isSmartWalletSBtcSponsorable(tx, feesInTokens, privateKeyToAddress(env.SPONSOR_PRIVATE_KEY, network))
					: {
							isSponsorable: false,
							data: reqBody,
					  },
			reqBody,
			env
		);
	},

	async sponsorDaoTransactions(reqBody: Partial<RequestBody>, env: Env) {
		return this.signAndBroadcastTransaction(
			({ tx, network }: Partial<Details>) =>
				tx !== undefined && network !== undefined
					? isDaoSponsorable(tx, env.DAO_DEPLOYER, network)
					: {
							isSponsorable: false,
							data: reqBody,
					  },
			reqBody,
			env
		);
	},

	async getInfo(env: Env) {
		const sponsor = privateKeyToAddress(env.SPONSOR_PRIVATE_KEY);

		// Get sponsor management state
		const sponsorManagementId = env.SPONSOR_MANAGEMENT.idFromName('default');
		const sponsorManagement = env.SPONSOR_MANAGEMENT.get(sponsorManagementId) as unknown as SponsorManagement;
		let sponsorState;
		try {
			sponsorState = await sponsorManagement.getState();
		} catch (e) {
			console.log('Failed to get sponsor state:', e);
		}
		return Response.json(
			{
				active: true,
				sponsor_addresses: [sponsor],
				fees: {
					not: MINIMUM_NOT_FEES,
					sponsor: [sponsor],
				},
				nonceManagement: sponsorState
					? {
							nextSponsorIndex: sponsorState.nextIndex,
							sponsors: sponsorState.nonces.map((nonces, index) => ({
								index,
								availableNonces: nonces,
								reservedNonces: sponsorState.reservedNonces[index],
								maxNonce: sponsorState.maxNonces[index],
							})),
					  }
					: undefined,
			},
			{ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
		);
	},
};

export function getSponsorManagement(env: Env) {
	const sponsorManagementId = env.SPONSOR_MANAGEMENT.idFromName('default');
	const sponsorManagement = env.SPONSOR_MANAGEMENT.get(sponsorManagementId) as unknown as SponsorManagement;
	return sponsorManagement;
}

async function estimateFee(tx: StacksTransactionWire, network: StacksNetworkName) {
	try {
		let txlength = estimateTransactionByteLength(tx);
		const payload = serializePayload(tx.payload);
		const [estimatedFee1] = await fetchFeeEstimateTransaction({
			payload,
			estimatedLength: txlength,
			network,
		});
		console.log({ estimateFee: estimatedFee1.fee });
		// Ensure the fee does not exceed the maximum allowed fee
		return estimatedFee1.fee > MAX_FEE ? MAX_FEE : estimatedFee1.fee;
	} catch (e) {
		console.log(e);
		return MAX_FEE;
	}
}

// Export Durable Object class
export { SponsorManagement } from './sponsorManagement';
