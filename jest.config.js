module.exports = {
    preset: 'jest-puppeteer',
    testPathIgnorePatterns: [
        './.next',
        './lib',
        './node_modules'
    ],
    collectCoverage: true,
    coveragePathIgnorePatterns: [
        "./node_modules",
        "./jest-puppeteer.config.js"
    ]
};
