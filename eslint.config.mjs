import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    "**/.next/**",
    "**/dist/**",
    "**/coverage/**",
    "playwright-report/**",
    "test-results/**",
    "packages/db/migrations/**",
  ]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
    },
  },
]);
