import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.toml' },
			},
		},
		// Only run Cloudflare-specific tests with workers pool
		include: ['test/index.spec.ts'],
	},
});
