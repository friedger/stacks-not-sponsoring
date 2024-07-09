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

import { bytesToHex } from '@stacks/common';
import { getFetchOptions } from '@stacks/network';
import {
	TransactionVersion,
	broadcastTransaction,
	estimateTransactionFeeWithFallback,
	getAddressFromPrivateKey,
} from '@stacks/transactions';
import { MINIMUM_NOT_FEES } from './lib/const';
import { readRequestBody, responseError } from './lib/helpers';
import { isNeonSponsorable } from './lib/neon';
import { Details, extractDetails, isSponsorable as isNotSponsorable, sponsorTx } from './lib/stacks';
import { ExecutionContext } from '@cloudflare/workers-types/experimental';
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

	async sponsorNotTransaction(reqBody: Partial<Details>, env: Env) {
		// get tx from request
		const details = await extractDetails(reqBody);

		if (details.error) {
			return responseError(details.error);
		}
		const { tx, network, feesInNot } = details;

		if (!tx || !network || !feesInNot) {
			return responseError('invalid request');
		}
		if (
			!isNotSponsorable(
				tx,
				feesInNot,
				getAddressFromPrivateKey(env.SPONSOR_PRIVATE_KEY, network.isMainnet() ? TransactionVersion.Mainnet : TransactionVersion.Testnet)
			)
		) {
			return responseError('not sponsorable');
		}

		const feeEstimate = await estimateTransactionFeeWithFallback(tx, network);
		const sponsorNonce = undefined; // TODO manage nonce of sponsor account for save chaining
		const sponsoredTx = await sponsorTx(tx, network, Number(env.DEV === 'true' ? 0 : feeEstimate), sponsorNonce, env);
		const result = await broadcastTransaction(sponsoredTx);
		return Response.json(
			{
				feeEstimate,
				result,
				txRaw: bytesToHex(sponsoredTx.serialize()),
			},
			{ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
		);
	},

	async sponsorNeonTransaction(reqBody: Partial<Details>, env: Env) {
		// get tx from request
		const details = await extractDetails(reqBody);

		if (details.error) {
			return responseError(details.error);
		}
		const { tx, network } = details;

		if (!tx || !network) {
			return responseError('invalid request');
		}
		if (!isNeonSponsorable(tx)) {
			return responseError('not sponsorable');
		}

		const feeEstimate = await estimateTransactionFeeWithFallback(tx, network);
		const sponsorNonce = undefined; // TODO manage nonce of sponsor account for save chaining
		const sponsoredTx = await sponsorTx(tx, network, Number(env.DEV === 'true' ? 0 : feeEstimate), sponsorNonce, env);
		const result = await broadcastTransaction(sponsoredTx);
		return Response.json(
			{
				feeEstimate,
				result,
				txRaw: bytesToHex(sponsoredTx.serialize()),
			},
			{ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
		);
	},

	async getStatus(env: Env) {
		return Response.json(
			{
				fees: {
					not: MINIMUM_NOT_FEES,
					sponsor: getAddressFromPrivateKey(env.SPONSOR_PRIVATE_KEY),
				},
			},
			{ headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
		);
	},
};
