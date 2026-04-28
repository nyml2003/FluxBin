import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"]
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ],
      "no-restricted-syntax": [
        "error",
        {
          "selector": "AssignmentPattern",
          "message": "Default function parameters are disabled. Resolve defaults inside the function body."
        },
        {
          "selector": "ReturnStatement > ConditionalExpression",
          "message": "Do not return conditional expressions directly. Assign the result to a local first."
        },
        {
          "selector": "ReturnStatement > LogicalExpression",
          "message": "Do not return logical expressions directly. Use an explicit branch or local variable."
        },
        {
          "selector": "CallExpression > ConditionalExpression",
          "message": "Do not pass conditional expressions directly as function arguments. Resolve them first."
        },
        {
          "selector": "CallExpression > LogicalExpression",
          "message": "Do not pass logical expressions directly as function arguments. Resolve them first."
        }
      ]
    }
  }
);
