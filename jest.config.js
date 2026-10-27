// Jest runs the engine and scan tests in Node (ML-27/ML-28, decision D13; MOB-03 adds src/scan). It uses babel-jest
// with only the React Native preset and no config file, so the app's babel.config.js (nativewind plugin) is never loaded.
// The database project (MOB-03 step 10) adds the decorators plugin that the WatermelonDB models need.
// The zone is pinned east of UTC so that the local-day date tests catch a toISOString regression on any machine (8b finding b).
process.env.TZ = 'Asia/Manila';
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
    {
      displayName: 'database',
      rootDir: __dirname,
      testEnvironment: 'node',
      roots: ['<rootDir>/src/database'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      transform: {
        '\\.(ts|js)$': [
          'babel-jest',
          {
            configFile: false,
            babelrc: false,
            presets: ['module:@react-native/babel-preset'],
            plugins: [['@babel/plugin-proposal-decorators', {version: 'legacy'}]],
          },
        ],
      },
    },
  ],
};
