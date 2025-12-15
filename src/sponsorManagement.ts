import { DurableObject } from 'cloudflare:workers';
import { SponsorManagementLogic } from './sponsorManagementLogic';

export { CHAINING_LIMIT, createInitialState, getMaxSponsors, SponsorManagementLogic } from './sponsorManagementLogic';

export class SponsorManagement extends DurableObject {
	private logic: SponsorManagementLogic;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.logic = new SponsorManagementLogic(ctx.storage, env.SPONSOR_PRIVATE_KEY_CSV);
	}

	async getState() {
		return this.logic.getState();
	}

	async getSponsorNonce() {
		return this.logic.getSponsorNonce();
	}

	async updateNonce(sponsorIndex: number, nonce: number, txid: string | undefined) {
		return this.logic.updateNonce(sponsorIndex, nonce, txid);
	}
}
