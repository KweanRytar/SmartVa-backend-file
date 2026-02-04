import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";

export default [
  js.configs.recommended,

  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    
    plugins: {
      react,
    },
       
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // Console handling
      "no-console": ["error", { allow: ["error"] }],

      // React (modern setup)
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",

      // You are NOT using PropTypes
      "react/prop-types": "off",

      // Relaxed rules (very important)
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-useless-catch": "warn",
      "no-empty": "warn",
    },
  },
];
