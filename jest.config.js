// Jest runs the engine tests in Node (ML-27/ML-28, decision D13). It uses babel-jest with only the React Native
// preset and no config file, so the app's babel.config.js (nativewind plugin) is never loaded.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/engine'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '\\.(ts|js)$': [
      'babel-jest',
      {
        configFile: false,
        babelrc: false,
        presets: ['module:@react-native/babel-preset'],
      },
    ],
  },
};
