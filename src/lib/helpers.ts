import { StacksNetworkName } from '@stacks/network';
import { deserializeTransaction, StacksTransactionWire } from '@stacks/transactions';

export type RequestBody = {
	tx: string;
	network: StacksNetworkName;
	feesInTokens: number;
};

export type Details = {
	error: string;
	tx: StacksTransactionWire;
	network: StacksNetworkName;
	feesInTokens: number; // smallest unit
};

export const getFeesInTokens = (feesInTokens: number | string) => {
	if (typeof feesInTokens === 'number') {
		return feesInTokens;
	}
	try {
		return parseInt(feesInTokens);
	} catch (e) {}
	return undefined;
};

export const extractDetails = async (requestBody: any): Promise<Partial<Details>> => {
	const network = requestBody.network;
	if (requestBody.tx && network && requestBody.feesInTokens) {
		const feesInTokens = getFeesInTokens(requestBody.feesInTokens);
		try {
			const tx = deserializeTransaction(requestBody.tx);
			return { tx, network, feesInTokens };
		} catch (e) {
			return { error: 'Invalid tx, must be hex format' };
		}
	}

	return { error: 'expected {tx: string; network: StacksNetworkName; feesInTokens: number }' };
};

/**
 * readRequestBody reads in the incoming request body
 * Use await readRequestBody(..) in an async function to get the string
 * @param {Request} request the incoming request to read from
 */
export async function readRequestBody(request: Request): Promise<Partial<RequestBody> | undefined> {
	const contentType = request.headers.get('content-type');
	if (contentType === null) {
	} else if (contentType.includes('text/plain')) {
		return JSON.parse(await request.text());
	}

	return undefined;
}

export function responseError(error: string) {
	return Response.json(
		{
			error,
		},
		{ status: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } }
	);
}
