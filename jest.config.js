module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/jest/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest/setup.js'],
  moduleFileExtensions: ['js', 'jsx'],
  transform: {},
  collectCoverageFrom: [
    'src/components/**/*.js',
    'src/utils/**/*.js',
    '!src/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};
