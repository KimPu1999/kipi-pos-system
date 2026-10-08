export default {
  plugins: ['@prettier/plugin-php'],
  printWidth: 100,
  tabWidth: 2,
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: '**/*.php',
      options: { parser: 'php', singleQuote: true },
    },
  ],
};
