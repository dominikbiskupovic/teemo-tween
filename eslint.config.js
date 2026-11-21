import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'demo/dist', 'docs-api', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // PromiseLike<void> and callbacks that may return nothing need void in parameter positions.
      '@typescript-eslint/no-invalid-void-type': 'off',
    },
  },
);
