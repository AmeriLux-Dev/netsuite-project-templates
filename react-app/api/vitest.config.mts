import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inlinedPackagesForNetsuiteStubs, netsuiteModuleStubAliases } from '@amerilux/netsuite-api/testing';
import { defineConfig } from 'vitest/config';

const apiDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify('0.0.0-test'),
        __BUILD_ID__: JSON.stringify('test'),
    },
    resolve: {
        alias: [
            // N/* is only real inside NetSuite; tests get the vi.fn shells the api package ships. The
            // wrapper's per-module entry points resolve to the same stubs.
            ...netsuiteModuleStubAliases([/^@amerilux\/netsuite-wrapper\/(record|query|search|log|https|runtime|task|url)$/]),
            { find: /^common\/(.*)$/, replacement: `${path.resolve(apiDir, '../common').split(path.sep).join('/')}/$1` },
        ],
    },
    test: {
        environment: 'node',
        include: ['__tests__/**/*.test.ts'],
        server: {
            deps: {
                // These packages require N/query, N/log and the rest at call time; inlining them routes
                // those requires through the alias above instead of Node's resolver.
                inline: ['@amerilux/netsuite-repository', '@amerilux/netsuite-wrapper', ...inlinedPackagesForNetsuiteStubs],
            },
        },
    },
});
