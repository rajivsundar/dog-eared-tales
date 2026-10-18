import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

const dexiePaths = [
  {
    name: 'dexie',
    message: 'Only src/stores/ may use Dexie. Use the store interfaces.',
  },
  { name: 'fake-indexeddb', message: 'Only src/stores/ may use IndexedDB.' },
]
const foliatePath = {
  name: 'foliate-js',
  message:
    'Only src/engine/reader/ may import foliate-js. Use the ReaderEngine interface.',
}
const foliatePattern = {
  group: ['foliate-js/*'],
  message:
    'Only src/engine/reader/ may import foliate-js. Use the ReaderEngine interface.',
}
const indexedDbGlobal = {
  name: 'indexedDB',
  message: 'Only src/stores/ may touch IndexedDB.',
}

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
    // Outside src/stores/ and src/engine/reader/: no Dexie and no foliate-js.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/stores/**', 'src/engine/reader/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [...dexiePaths, foliatePath], patterns: [foliatePattern] },
      ],
      'no-restricted-globals': ['error', indexedDbGlobal],
    },
  },
  {
    // Only src/stores/ may touch IndexedDB. It may use foliate-js no more than anyone else.
    files: ['src/stores/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [foliatePath], patterns: [foliatePattern] },
      ],
    },
  },
  {
    // Only src/engine/reader/ may import foliate-js. It may not touch IndexedDB.
    files: ['src/engine/reader/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { paths: dexiePaths }],
      'no-restricted-globals': ['error', indexedDbGlobal],
    },
  },
  {
    // Build scripts run in Node, not in the browser.
    files: ['scripts/**/*.ts', 'tools/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
)
