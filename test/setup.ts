import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';

// Re-export for use in tests
export { env, createExecutionContext, waitOnExecutionContext, SELF };

// Define IncomingRequest if not available globally
declare global {
    const IncomingRequest: typeof Request;
}