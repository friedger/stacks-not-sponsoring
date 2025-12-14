import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/neon.spec.ts', 'test/fak.spec.ts', 'test/sponsorManagement.spec.ts', 'test/not.spec.ts'],
        environment: 'node',
    },
});