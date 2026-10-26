// Jest runs the engine and scan tests in Node (ML-27/ML-28, decision D13; MOB-03 adds src/scan). It uses babel-jest
// with only the React Native preset and no config file, so the app's babel.config.js (nativewind plugin) is never loaded.
module.exports = {
  projects: [
    {
      displayName: 'engine',
      rootDir: __dirname,
      testEnvironment: 'node',
      roots: ['<rootDir>/src/engine', '<rootDir>/src/scan'],
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
    },
  ],
};
