import { Details } from './stacks';

/**
 * readRequestBody reads in the incoming request body
 * Use await readRequestBody(..) in an async function to get the string
 * @param {Request} request the incoming request to read from
 */
export async function readRequestBody(request: Request): Promise<Partial<Details> | undefined> {
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
		{ status: 400 }
	);
}
