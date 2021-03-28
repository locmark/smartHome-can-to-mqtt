module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true
  },
  extends: [
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12
  },
  plugins: [
    '@typescript-eslint'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 0,
    "indent": [
        "error",
        4
    ],
    "quotes": [
        "error",
        "single",
        {
            "allowTemplateLiterals": true
        }
    ],
    "semi": [
        "error",
        "always"
    ],
    "no-unused-vars": 0,
    "no-var": [
        "error"
    ]
  }
}
