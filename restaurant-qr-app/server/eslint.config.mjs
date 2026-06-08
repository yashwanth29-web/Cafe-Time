import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                "process": "readonly",
                "console": "readonly",
                "require": "readonly",
                "module": "readonly",
                "__dirname": "readonly",
                "setTimeout": "readonly",
                "setInterval": "readonly",
                "clearTimeout": "readonly",
                "clearInterval": "readonly",
                "Buffer": "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn"
        }
    }
];
