import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SponsorManagementLogic, SponsorState, StorageInterface, getMaxSponsors } from '../src/sponsorManagementLogic';

describe('getMaxSponsors', () => {
	it('should return 1 for undefined', () => {
		expect(getMaxSponsors(undefined)).toBe(1);
	});

	it('should return 1 for empty string', () => {
		expect(getMaxSponsors('')).toBe(1);
	});

	it('should return 1 for single key', () => {
		expect(getMaxSponsors('key1')).toBe(1);
	});

	it('should return count for multiple keys', () => {
		expect(getMaxSponsors('key1,key2,key3')).toBe(3);
	});

	it('should ignore empty entries', () => {
		expect(getMaxSponsors('key1,,key2')).toBe(2);
	});
});

describe('SponsorManagementLogic', () => {
	let sponsorManagement: SponsorManagementLogic;
	let mockStorage: StorageInterface;

	beforeEach(() => {
		mockStorage = {
			get: vi.fn(),
			put: vi.fn(),
		};
		sponsorManagement = new SponsorManagementLogic(mockStorage, 'key1');
	});

	it('should reserve and update nonces correctly', async () => {
		const sponsorIndex = 0;
		const initialNonce = 100;
		const state: SponsorState = {
			nextIndex: sponsorIndex,
			nonces: [[initialNonce, initialNonce + 1]],
			reservedNonces: [[]],
			maxNonces: [initialNonce + 1],
		};

		vi.mocked(mockStorage.get).mockResolvedValueOnce(state);

		// Reserve a nonce
		const result = await sponsorManagement.getSponsorNonce();

		expect(result.nonce).toBe(initialNonce);
		expect(result.sponsorIndex).toBe(sponsorIndex);
		expect(state.nonces[sponsorIndex].length).toBe(2);
		expect(state.reservedNonces[sponsorIndex].length).toBe(1);
		expect(state.reservedNonces[sponsorIndex]).toContain(initialNonce);

		// Test updateNonce for used nonce
		vi.mocked(mockStorage.get).mockResolvedValueOnce(state);
		await sponsorManagement.updateNonce(sponsorIndex, initialNonce, 'txid');
		expect(state.reservedNonces[sponsorIndex]).not.toContain(initialNonce);

		// Test updateNonce for unused nonce
		state.reservedNonces[sponsorIndex].push(initialNonce + 1);
		vi.mocked(mockStorage.get).mockResolvedValueOnce(state);
		await sponsorManagement.updateNonce(sponsorIndex, initialNonce + 1, undefined);
		expect(state.reservedNonces[sponsorIndex]).not.toContain(initialNonce + 1);
		expect(state.nonces[sponsorIndex]).toContain(initialNonce + 1);
		expect(state.nonces[sponsorIndex]).toEqual(state.nonces[sponsorIndex].slice().sort((a, b) => a - b));
	});

	it('should throw if no nonces available', async () => {
		const state: SponsorState = {
			nextIndex: 0,
			nonces: [[]],
			reservedNonces: [[]],
			maxNonces: [0],
		};

		vi.mocked(mockStorage.get).mockResolvedValueOnce(state);
		await expect(sponsorManagement.getSponsorNonce()).rejects.toThrow('No nonces available for this sponsor');
	});

	it('should throw if sponsor state not found on update', async () => {
		vi.mocked(mockStorage.get).mockResolvedValueOnce(undefined);
		await expect(sponsorManagement.updateNonce(0, 100, 'txid')).rejects.toThrow('Sponsor state not found');
	});
});

describe('SponsorManagementLogic with multiple sponsors', () => {
	let sponsorManagement: SponsorManagementLogic;
	let mockStorage: StorageInterface;

	beforeEach(() => {
		mockStorage = {
			get: vi.fn(),
			put: vi.fn(),
		};
		sponsorManagement = new SponsorManagementLogic(mockStorage, 'key1,key2,key3');
	});

	it('should rotate through sponsors', async () => {
		const state: SponsorState = {
			nextIndex: 0,
			nonces: [[100], [200], [300]],
			reservedNonces: [[], [], []],
			maxNonces: [100, 200, 300],
		};

		vi.mocked(mockStorage.get).mockResolvedValue(state);

		const result1 = await sponsorManagement.getSponsorNonce();
		expect(result1.sponsorIndex).toBe(0);
		expect(result1.nonce).toBe(100);

		const result2 = await sponsorManagement.getSponsorNonce();
		expect(result2.sponsorIndex).toBe(1);
		expect(result2.nonce).toBe(200);

		const result3 = await sponsorManagement.getSponsorNonce();
		expect(result3.sponsorIndex).toBe(2);
		expect(result3.nonce).toBe(300);
	});
});
