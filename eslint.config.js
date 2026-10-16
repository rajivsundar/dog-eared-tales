import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'playwright-report', 'test-results'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      prettier,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Only src/stores/ may touch IndexedDB.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/stores/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'dexie',
              message:
                'Only src/stores/ may use Dexie. Use the store interfaces.',
            },
            {
              name: 'fake-indexeddb',
              message: 'Only src/stores/ may use IndexedDB.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'indexedDB',
          message: 'Only src/stores/ may touch IndexedDB.',
        },
      ],
    },
  },
)
