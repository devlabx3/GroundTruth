import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist', 'node_modules'] },

  // Ficheros de configuración: siguen siendo JS plano.
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    rules: { ...js.configs.recommended.rules },
  },

  // La aplicación. Antes esta sección no existía y el lint recorría 4 ficheros de
  // configuración creyendo que revisaba el proyecto: verde por no mirar nada.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2022,
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint.plugin, 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended[2].rules,
      ...reactHooks.configs.recommended.rules,

      // `no-unused-vars` de base no entiende los tipos: da falsos positivos con
      // interfaces y genéricos. La versión de TS sí.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]', caughtErrors: 'none' },
      ],

      // El `any` explícito se avisa, no se prohíbe: hay fronteras (el recorrido por
      // ruta de los parámetros) donde el cast acotado es la opción honesta.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
