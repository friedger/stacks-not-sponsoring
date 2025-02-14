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

import { ExecutionContext } from '@cloudflare/workers-types/experimental';
import { createClient, OperationResponse } from '@stacks/blockchain-api-client';
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
import { Details, extractDetails, readRequestBody, RequestBody, responseError } from './lib/helpers';
import { isNeonSponsorable } from './lib/neon';
import { isSponsorable as isNotSponsorable } from './lib/not';
import { isSponsorable as isSbtcSponsorable } from './lib/sbtc';
import { isSponsorable as isFakSponsorable } from './lib/fak';
import { sponsorTx } from './lib/stacks';

const opts = getFetchOptions();
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

			return Response.json(
				{
					error: 'unsupported url. try /not',
				},
				{ status: 404 }
			);
		} else if (request.method === 'GET') {
			if (url.pathname === 'not/v1/info' || url.pathname === 'neon/v1/info') {
				return this.getInfo(env);
			}
			return Response.json(
				{
					error: 'unsupported url. try /status',
				},
				{ status: 404 }
			);
		} else {
			return Response.json(
				{
					error: 'unsupported http method',
				},
				{ status: 404 }
			);
		}
	},

	async signAndBroadcastTransaction(
		sponsoringCheck: (reqBody: Partial<Details>) => { isSponsorable: boolean; data: any },
		reqBody: Partial<RequestBody>,
		env: Env
	) {
		try {
			// get tx from request
			const details = await extractDetails(reqBody);

			if (details.error) {
				return responseError(details.error);
			}
			const { tx, network, feesInTokens } = details;

			if (!tx || !network || !feesInTokens) {
				return responseError('invalid request ' + JSON.stringify(details));
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

			const feeEstimate = await estimateFee(tx, network);
			const sponsorNonce = undefined; // TODO manage nonce of sponsor account for save chaining
			const sponsoredTx = await sponsorTx(tx, network, Number(env.DEV === 'true' ? 0 : feeEstimate), sponsorNonce, env);
			const result = await broadcastTransaction({ transaction: sponsoredTx });
			if ('error' in result) {
				return Response.json(
					{
						tx: (reqBody as any).tx,
						error: result,
					},
					{ status: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
				);
			} else {
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
			return Response.json(
				{
					txHex: (reqBody as any).tx,
					txHex2: transactionToHex(deserializeTransaction((reqBody as any).tx)),
					error: 'execption' + JSON.stringify(e),
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
					? isFakSponsorable(tx, privateKeyToAddress(env.SPONSOR_PRIVATE_KEY, network))
					: {
							isSponsorable: false,
							data: reqBody,
					  },
			reqBody,
			env
		);
	},

	async getInfo(env: Env) {
		const client = createClient({
			baseUrl: 'https://api.mainnet.hiro.so',
		});
		client.use({
			onRequest({ request }) {
				request.headers.set('x-custom-header', 'custom-value');
				return request;
			},
		});

		const sponsor = privateKeyToAddress(env.SPONSOR_PRIVATE_KEY);
		let balance: OperationResponse['/extended/v1/address/{principal}/balances'] | undefined;
		try {
			const response = await client.GET('/extended/v1/address/{principal}/balances', { params: { path: { principal: sponsor } } });
			balance = response.data;
			return Response.json(
				{
					active: true,
					sponsor_addresses: [sponsor],
					fees: {
						not: MINIMUM_NOT_FEES,
						sponsor: [sponsor],
					},
					balances: [
						{
							sponsor: sponsor,
							balance: balance?.stx,
						},
					],
				},
				{ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
			);
		} catch (e) {
			console.log(e);
			return Response.json(
				{
					fees: {
						not: MINIMUM_NOT_FEES,
						sponsor: [sponsor],
					},
					error: e,
				},
				{ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
			);
		}
	},
};

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
