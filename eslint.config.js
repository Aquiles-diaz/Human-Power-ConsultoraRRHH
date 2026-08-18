import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  // `.claude` guarda worktrees, que son COPIAS COMPLETAS del repo: sin esto,
  // casi la mitad de lo que se lintea es código de otra rama, y un worktree
  // rancio puede poner el gate en rojo por algo que no está en la que se está
  // tocando. Vitest ya lo excluye por el mismo motivo (vite.config.ts).
  // ESLint 9 (flat config) NO lee .gitignore, así que hay que decirlo acá.
  globalIgnores(['dist', '.claude']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
