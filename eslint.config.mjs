import tseslint from "typescript-eslint";
import hono from "@hono/eslint-config";

export default [
  ...hono,

  ...tseslint.configs.recommended,

  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAnyKeyword",
          message: "Use a specific type instead of 'any'.",
        },
        {
          selector: "TSUnknownKeyword",
          message: "Use a specific type instead of 'unknown'.",
        },
      ],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "eslint.config.mjs"],
  },
];
