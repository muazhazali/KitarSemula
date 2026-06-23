import next from 'eslint-config-next';
import prettier from 'eslint-config-prettier';

const nextConfigs = /** @type {import('eslint').Linter.Config[]} */ (/** @type {unknown} */ (next));

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: ['node_modules/**', '.next/**', 'pnpm-lock.yaml', 'dev-server*.log'],
  },
  ...nextConfigs,
  prettier,
];

export default config;
