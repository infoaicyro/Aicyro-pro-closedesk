// ESLint flat config. eslint-config-next v16 ships native flat configs,
// so it is imported directly (the old FlatCompat wrapper crashes on it).
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "functions/**", // Cloud Functions have their own .eslintrc.js
      "evaluations/**",
    ],
  },
  ...nextVitals,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      // React Compiler readiness rules (react-hooks v7). The existing dashboard
      // and site code predates them; fixing means refactoring effect logic, so
      // they are reported as warnings until that work is scheduled.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default eslintConfig;
