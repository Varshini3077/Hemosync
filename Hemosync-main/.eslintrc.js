/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ["@hemosync/eslint-config"],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.base.json", "./apps/*/tsconfig.json", "./api/tsconfig.json", "./packages/*/tsconfig.json"],
  },
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "coverage/",
    ".turbo/",
    "**/*.js",
    "!.eslintrc.js",
  ],
  rules: {
    // Downgraded to warn — strict mode deferred post-hackathon
    // Also covers import.meta.env member access patterns
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/no-unsafe-argument": "warn",
    "@typescript-eslint/no-unsafe-return": "warn",
    "@typescript-eslint/explicit-function-return-type": "warn",
  },
};
