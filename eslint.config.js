// ESLint flat config for Next.js + TypeScript
// Why: keep codebase clean, consistent, and catch issues early.
// How to use:
//  - Run: `npm run lint` or `npm run lint:fix`
//  - Adjust rules below to tune strictness.

import next from 'eslint-config-next';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  // Next.js recommended configs (includes React, TS, a11y best-practices)
  ...next,

  // Project-level rules and plugins
  {
    plugins: {
      'unused-imports': unusedImports,
    },
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'coverage/**',
    ],
    rules: {
      // Prefer auto-removal of unused imports
      'unused-imports/no-unused-imports': 'error',
      // Warn on unused vars but ignore rest siblings for common patterns
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', args: 'after-used', ignoreRestSiblings: true },
      ],
      // Avoid duplicate/conflicting messages with TS rule
      '@typescript-eslint/no-unused-vars': 'off',

      // React hooks/next rules tuned to reduce noise during refactors
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      '@next/next/no-img-element': 'warn',
      'react/no-unescaped-entities': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },
];
