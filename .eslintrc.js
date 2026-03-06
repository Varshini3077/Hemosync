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
};
