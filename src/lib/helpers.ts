import { StacksNetworkName } from '@stacks/network';
import { StacksTransactionWire } from '@stacks/transactions';

export type RequestBody = {
	tx: string;
	network: StacksNetworkName;
	feesInNot: number;
};

export type Details = {
	error: string;
	tx: StacksTransactionWire;
	network: StacksNetworkName;
	feesInNot: number;
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
