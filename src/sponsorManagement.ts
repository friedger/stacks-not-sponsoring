import { DurableObject } from 'cloudflare:workers';
import { SponsorManagementLogic } from './sponsorManagementLogic';

export { MAX_SPONSORS, CHAINING_LIMIT, SponsorManagementLogic } from './sponsorManagementLogic';

export class SponsorManagement extends DurableObject {
    private logic: SponsorManagementLogic;

    constructor(ctx: DurableObjectState, env?: any) {
        super(ctx, env);
        this.logic = new SponsorManagementLogic(ctx.storage);
    }

    async getSponsorNonce() {
        return this.logic.getSponsorNonce();
    }

    async updateNonce(sponsorIndex: number, nonce: number, txid: string | undefined) {
        return this.logic.updateNonce(sponsorIndex, nonce, txid);
    }

	async getState() {
		return this.logic.getState();
	}
}
