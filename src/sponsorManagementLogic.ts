export const MAX_SPONSORS = 1;
export const CHAINING_LIMIT = 25;

export interface SponsorState {
	nextIndex: number;
	nonces: number[][];
	reservedNonces: number[][];
	maxNonces: number[];
}

export interface StorageInterface {
	get<T>(key: string): Promise<T | undefined>;
	put<T>(key: string, value: T): Promise<void>;
}

const INITIAL_STATE: SponsorState = {
	nextIndex: 0,
	nonces: Array.from({ length: MAX_SPONSORS }, () => []),
	reservedNonces: Array.from({ length: MAX_SPONSORS }, () => []),
	maxNonces: Array.from({ length: MAX_SPONSORS }, () => 0),
};

export class SponsorManagementLogic {
	constructor(private storage: StorageInterface) {}

	async getState(): Promise<SponsorState> {
		const sponsorState: SponsorState = (await this.storage.get<SponsorState>('sponsors')) || INITIAL_STATE;
		return sponsorState;
	}

	async getSponsorNonce(): Promise<{ sponsorIndex: number; nonce: number }> {
		const sponsorState: SponsorState = (await this.storage.get<SponsorState>('sponsors')) || INITIAL_STATE;

		const sponsorIndex = sponsorState.nextIndex;

		// Enforce chaining limit
		if (sponsorState.reservedNonces[sponsorIndex].length >= CHAINING_LIMIT) {
			throw new Error('Too many reserved nonces for this sponsor');
		}

		// Get next nonce
		const nextNonce = sponsorState.nonces[sponsorIndex].shift();
		if (nextNonce === undefined) {
			throw new Error('No nonces available for this sponsor');
		}

		// Append a new nonce and update max
		sponsorState.nonces[sponsorIndex].push(sponsorState.maxNonces[sponsorIndex] + 1);
		sponsorState.maxNonces[sponsorIndex] += 1;

		// Remember nonce in use
		sponsorState.reservedNonces[sponsorIndex].push(nextNonce);

		// Rotate sponsor
		sponsorState.nextIndex = (sponsorState.nextIndex + 1) % MAX_SPONSORS;

		await this.storage.put('sponsors', sponsorState);

		return { sponsorIndex, nonce: nextNonce };
	}

	async updateNonce(sponsorIndex: number, nonce: number, txid: string | undefined): Promise<void> {
		const sponsorState = await this.storage.get<SponsorState>('sponsors');
		if (sponsorState === undefined) {
			throw new Error('Sponsor state not found');
		}

		// Remove reserved nonce from reservedNonces
		const reservedNonces = sponsorState.reservedNonces[sponsorIndex] || [];
		const index = reservedNonces.indexOf(nonce);
		if (index !== -1) {
			reservedNonces.splice(index, 1);
			sponsorState.reservedNonces[sponsorIndex] = reservedNonces;

			if (!txid) {
				// For unused nonces, add nonce back to nonces in order
				const nonces = sponsorState.nonces[sponsorIndex] || [];
				const insertIndex = nonces.findIndex((n) => n > nonce);
				if (insertIndex === -1) {
					nonces.push(nonce);
				} else {
					nonces.splice(insertIndex, 0, nonce);
				}
				sponsorState.nonces[sponsorIndex] = nonces;
			}
		}

		await this.storage.put('sponsors', sponsorState);
	}
}
