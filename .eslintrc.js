module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
        sourceType: "module", // Allows for the use of imports
    },
    extends: [
        // Uses the recommended rules from the @typescript-eslint/eslint-plugin
        "plugin:@typescript-eslint/recommended",
        // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. This should always be the last item in the extends array.
        "plugin:prettier/recommended",
    ],
    rules: {
        // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
        "@typescript-eslint/no-non-null-assertion": "off",
    },
    overrides: [
        // Overrides for js files
        {
            files: ["*.js"],
            rules: {
                "@typescript-eslint/no-var-requires": 0,
            },
        },
    ],
};
