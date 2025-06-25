import { beforeEach, describe, expect, it } from 'vitest';
import { SponsorManagement } from '../src/sponsorManagement';

describe('SponsorManagement', () => {
	let sponsorManagement: SponsorManagement;
	let storageMock: any;

	beforeEach(() => {
		storageMock = {
			get: jest.fn(),
			put: jest.fn(),
		};
		sponsorManagement = new SponsorManagement({ storage: storageMock });
	});

	it('should reserve and update nonces correctly', async () => {
		// Setup initial state
		const sponsorIndex = 0;
		const initialNonce = 100;
		const state = {
			nextIndex: sponsorIndex,
			nonces: [[initialNonce, initialNonce + 1], [], [], [], [], [], [], [], [], []],
			reservedNonces: [[], [], [], [], [], [], [], [], [], []],
			maxNonces: [initialNonce + 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		};
		storageMock.get.mockResolvedValueOnce(state);

		// Reserve a nonce
		await sponsorManagement.getSponsorNonce();

		// Should move nonce from nonces to reservedNonces
		expect(state.nonces[sponsorIndex].length).toBe(2); // one shifted, one pushed
		expect(state.reservedNonces[sponsorIndex].length).toBe(1);

		// Now test updateNonce for used nonce (should remove from reserved, not add back)
		storageMock.get.mockResolvedValueOnce(state);
		await sponsorManagement.updateNonce(sponsorIndex, initialNonce, 'txid');
		expect(state.reservedNonces[sponsorIndex]).not.toContain(initialNonce);

		// Now test updateNonce for unused nonce (should remove from reserved, add back to nonces in order)
		state.reservedNonces[sponsorIndex].push(initialNonce + 1);
		storageMock.get.mockResolvedValueOnce(state);
		await sponsorManagement.updateNonce(sponsorIndex, initialNonce + 1, undefined);
		expect(state.reservedNonces[sponsorIndex]).not.toContain(initialNonce + 1);
		expect(state.nonces[sponsorIndex]).toContain(initialNonce + 1);
		// Should be in order
		expect(state.nonces[sponsorIndex]).toEqual(state.nonces[sponsorIndex].slice().sort((a, b) => a - b));
	});

	it('should throw if no nonces available', async () => {
		const state = {
			nextIndex: 0,
			nonces: [[], [], [], [], [], [], [], [], [], []],
			reservedNonces: [[], [], [], [], [], [], [], [], [], []],
			maxNonces: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		};
		storageMock.get.mockResolvedValueOnce(state);
		await expect(sponsorManagement.getSponsorNonce()).rejects.toThrow('No nonces available for this sponsor');
	});
});
