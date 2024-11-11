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
import { StacksNetwork } from '@stacks/network';
import { broadcastTransaction, fetchFeeEstimateTransaction, privateKeyToAddress, transactionToHex } from '@stacks/transactions';
import { MAX_FEE, MINIMUM_NOT_FEES } from './lib/const';
import { Details, readRequestBody, responseError } from './lib/helpers';
import { isNeonSponsorable } from './lib/neon';
import { extractDetails, isSponsorable as isNotSponsorable } from './lib/not';
import { sponsorTx } from './lib/stacks';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'POST') {
			const reqBody = await readRequestBody(request);
			if (!reqBody) {
				return responseError('missing request body');
			}
			if (url.pathname === '/not') {
				return this.sponsorNotTransaction(reqBody, env);
			}
			if (url.pathname === '/neon') {
				return this.sponsorNeonTransaction(reqBody, env);
			}

			return Response.json(
				{
					error: 'unsupported url. try /not',
				},
				{ status: 404 }
			);
		} else if (request.method === 'GET') {
			if (url.pathname === '/status') {
				return this.getStatus(env);
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

	async signAndBroadcastTransaction(sponsoringCheck: (reqBody: Partial<Details>) => boolean, reqBody: Partial<Details>, env: Env) {
		// get tx from request
		const details = await extractDetails(reqBody);

		if (details.error) {
			return responseError(details.error);
		}
		const { tx, network, feesInNot } = details;

		if (!tx || !network || !feesInNot) {
			return responseError('invalid request');
		}
		if (!sponsoringCheck(reqBody)) {
			return responseError('not sponsorable');
		}

		const feeEstimate = await estimateFee(transactionToHex(tx), network);
		const sponsorNonce = undefined; // TODO manage nonce of sponsor account for save chaining
		const sponsoredTx = await sponsorTx(tx, network, Number(env.DEV === 'true' ? 0 : feeEstimate), sponsorNonce, env);
		const result = await broadcastTransaction({ transaction: sponsoredTx });
		return Response.json(
			{
				feeEstimate,
				result,
				txRaw: transactionToHex(sponsoredTx),
			},
			{ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
		);
	},

	async sponsorNotTransaction(reqBody: Partial<Details>, env: Env) {
		return this.signAndBroadcastTransaction(
			({ tx, feesInNot, network }: Partial<Details>) =>
				tx !== undefined &&
				feesInNot !== undefined &&
				network !== undefined &&
				isNotSponsorable(tx, feesInNot, privateKeyToAddress(env.SPONSOR_PRIVATE_KEY, network)),
			reqBody,
			env
		);
	},

	async sponsorNeonTransaction(reqBody: Partial<Details>, env: Env) {
		return this.signAndBroadcastTransaction(({ tx }: Partial<Details>) => tx !== undefined && isNeonSponsorable(tx), reqBody, env);
	},

	async getStatus(env: Env) {
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
		} catch (e) {
			console.log(e);
		}
		return Response.json(
			{
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
	},
};

async function estimateFee(txHex: string, network: StacksNetwork) {
	const [estimatedFee0, feeEstimate1, feeEstimate2] = await fetchFeeEstimateTransaction({
		payload: txHex,
		network,
	});
	// Ensure the fee does not exceed the maximum allowed fee
	return estimatedFee0.fee > MAX_FEE ? MAX_FEE : estimatedFee0;
}
