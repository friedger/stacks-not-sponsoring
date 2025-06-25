import { DurableObject } from 'cloudflare:workers';

const MAX_SPONSORS = 10;
const CHAINING_LIMIT = 25;

export class SponsorManagement extends DurableObject {
	async getSponsorNonce() {
		const sponsorState: { nextIndex: number; nonces: number[][]; reservedNonces: number[][]; maxNonces: number[] } =
			(await this.ctx.storage.get('sponsors')) || {
				nextIndex: 0,
				nonces: Array.from({ length: MAX_SPONSORS }, (_, i) => []),
				reservedNonces: Array.from({ length: MAX_SPONSORS }, (_, i) => []),
				maxNonces: Array.from({ length: MAX_SPONSORS }, (_, i) => 0),
			};

		const sponsorIndex = sponsorState.nextIndex;
		// initalize from stacks node
		if (sponsorState.nonces[sponsorIndex].length === 0) {
			// fetch nonce for sponsor with index lastSponsor.index
			const nonce = client.get(`/v2/accounts/${sponsorIndex}/nonce`);
			const nonces = Array.from({ length: CHAINING_LIMIT }, (_, i) => nonce + i);
			sponsorState.nonces[sponsorIndex] = nonces;
			sponsorState.maxNonces[sponsorIndex] = nonce + CHAINING_LIMIT - 1;
		}

		// get next nonce and append a new once
		const nextNonce = sponsorState.nonces[sponsorIndex].shift();
		if (nextNonce === undefined) {
			throw new Error('No nonces available for this sponsor');
		}
		sponsorState.nonces[sponsorIndex].push(sponsorState.maxNonces[sponsorIndex] + 1);
		sponsorState.maxNonces[sponsorIndex] += 1;

		// remember nonce in use
		sponsorState.reservedNonces[sponsorIndex].push(nextNonce);

		// rotate sponsor
		const index = (sponsorIndex + 1) % MAX_SPONSORS;

		// store updated state
		await this.ctx.storage.put('sponsors', { nextIndex: index, nonces: sponsorState.nonces });

		return { sponsorIndex, nonce: nextNonce };
	}

	async updateNonce(sponsorIndex: number, nonce: number, txid: string | undefined) {
		const sponsorState: { index: number; nonces: number[][]; reservedNonces: number[][] } | undefined = await this.ctx.storage.get(
			'sponsors'
		);
		if (sponsorState === undefined) {
			throw new Error('Sponsor state not found');
		}

		// remove reserved nonce from reservedNonces
		const reservedNonces = sponsorState.reservedNonces[sponsorIndex] || [];
		const index = reservedNonces.indexOf(nonce);
		if (index !== -1) {
			// remove nonce from reserved list
			reservedNonces.splice(index, 1);
			sponsorState.reservedNonces[sponsorIndex] = reservedNonces;

			if (!txid) {
				// for unused nonces, add nonce back to nonces keeping at the position to keep the order of nonces
				const nonces = sponsorState.nonces[sponsorIndex] || [];
				const insertIndex = nonces.findIndex((n) => n > nonce);
				if (insertIndex === -1) {
					// if no position found, push to the end
					nonces.push(nonce);
				} else {
					// insert at the found position
					nonces.splice(insertIndex, 0, nonce);
					// if txs are pending, make sure to send a dust tx
				}
				sponsorState.nonces[sponsorIndex] = nonces;
			}
		}
	}
}
