module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2021: true,
  },
  extends: ['eslint:recommended', 'plugin:vue/vue3-recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['vue'],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-setup-props-destructure': 'off',
    'vue/script-setup-uses-vars': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    semi: ['error', 'never'],
    quotes: ['error', 'single'],
    'comma-dangle': ['error', 'always-multiline'],
    'vue/max-attributes-per-line': [
      'warn',
      {
        singleline: { max: 4 },
        multiline: { max: 1 },
      },
    ],
    'vue/singleline-html-element-content-newline': 'off',
  },
}
