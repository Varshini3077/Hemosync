/** @type {import("eslint").Linter.Config} */
module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    // Enforce no usage of `any` type
    "@typescript-eslint/no-explicit-any": "error",
    // Require explicit return types on functions
    "@typescript-eslint/explicit-function-return-type": "warn",
    // Consistent type imports
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports" },
    ],
    // React 17+ doesn't need React in scope
    "react/react-in-jsx-scope": "off",
    // Enforce hooks rules
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    // Prefer const over let where possible
    "prefer-const": "error",
    // No unused variables
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
