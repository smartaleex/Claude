/* Lint: catches the mistakes that only show up at runtime in a no-build app,
   chiefly a name that is used but never imported (a ReferenceError the moment
   that screen opens) and imports that nothing uses. Run: npm run lint */
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'zetaris-prospector/**', 'macro-tracker.html', 'tests/out/**'] },
  js.configs.recommended,
  {
    files: ['assets/js/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser, ...globals.serviceworker } },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'off',
      'no-cond-assign': ['error', 'except-parens'],
    },
  },
  {
    files: ['sw.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.serviceworker } },
    rules: { 'no-unused-vars': 'off', 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  {
    files: ['tests/**/*.mjs', 'tools/**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
    },
  },
];
