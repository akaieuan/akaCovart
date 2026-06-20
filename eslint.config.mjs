import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      // Frozen prototype — not part of the lint surface
      "index.html",
      "support.js",
      "server.js",
      "Album Art Engine.dc.html",
      "uploads/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // The engine module is framework-agnostic and exposes a frozen public
    // contract that intentionally uses `Record<string, any>` for params and
    // underscore-prefixed unused args in stub bodies.
    files: ["src/engine/**/*.ts", "src/presets/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
