import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.toml' },
				miniflare: {
					durableObjects: {
						SPONSOR_MANAGEMENT: 'SponsorManagement',
					},
				},
			},
		},
		include: ['test/index.spec.ts'],
	},
});
