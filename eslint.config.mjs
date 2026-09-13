import next from 'eslint-config-next';
import prettier from 'eslint-config-prettier';

const nextConfigs = /** @type {import('eslint').Linter.Config[]} */ (/** @type {unknown} */ (next));

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.open-next/**',
      'pnpm-lock.yaml',
      'dev-server*.log',
      'worker-configuration.d.ts',
    ],
  },
  ...nextConfigs,
  prettier,
];

export default config;
