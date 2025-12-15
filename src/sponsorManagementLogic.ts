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

export function getMaxSponsors(sponsorPrivateKeyCsv: string | undefined): number {
    if (!sponsorPrivateKeyCsv) {
        return 1;
    }
    const keys = sponsorPrivateKeyCsv.split(',').filter((k) => k.trim().length > 0);
    return Math.max(1, keys.length);
}

export function createInitialState(maxSponsors: number): SponsorState {
    return {
        nextIndex: 0,
        nonces: Array.from({ length: maxSponsors }, () => []),
        reservedNonces: Array.from({ length: maxSponsors }, () => []),
        maxNonces: Array.from({ length: maxSponsors }, () => 0),
    };
}

export class SponsorManagementLogic {
    private maxSponsors: number;

    constructor(
        private storage: StorageInterface,
        sponsorPrivateKeyCsv?: string
    ) {
        this.maxSponsors = getMaxSponsors(sponsorPrivateKeyCsv);
    }

    async getState(): Promise<SponsorState> {
        const sponsorState: SponsorState =
            (await this.storage.get<SponsorState>('sponsors')) || createInitialState(this.maxSponsors);
        return sponsorState;
    }

    async getSponsorNonce(): Promise<{ sponsorIndex: number; nonce: number }> {
        const sponsorState: SponsorState =
            (await this.storage.get<SponsorState>('sponsors')) || createInitialState(this.maxSponsors);

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
        sponsorState.nextIndex = (sponsorState.nextIndex + 1) % this.maxSponsors;

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
