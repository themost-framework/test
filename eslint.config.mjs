import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import babelParser from "babel-eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores(["**/*.d.ts", "modules/test/dist"]), {
    extends: compat.extends("eslint:recommended"),

    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.node,
            ...globals.jquery,
            describe: false,
            it: false,
            before: false,
            beforeEach: false,
            beforeAll: false,
            after: false,
            expect: false,
            spyOn: false,
            jasmine: false,
        },

        parser: babelParser,
    },

    rules: {
        "no-console": "off",
        "no-invalid-this": "warn",
        "no-undef": "error",
        "no-unused-vars": "warn",
        "no-var": ["error"],
        quotes: ["error", "single"],
        strict: [2, "never"],
    },
}]);