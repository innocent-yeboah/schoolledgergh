import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "supabase/.temp/**",
      "public/sw.js",
      "test-results/**",
      "playwright-report/**",
      "blob-report/**",
    ],
  },
];

export default eslintConfig;
