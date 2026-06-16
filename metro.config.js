/**
 * metro.config.js
 * Metro bundler configuration for the ER Offline SDK demo app.
 *
 * Adds the packages/ directory to Metro's watch list so that
 * @skylab/emergency-sdk (packages/emergency-sdk) is resolved
 * correctly at runtime via the npm workspace symlink.
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const packagesRoot = path.resolve(projectRoot, 'packages');

const config = getDefaultConfig(projectRoot);

// Watch the workspace packages directory
config.watchFolders = [packagesRoot, ...(config.watchFolders ?? [])];

// Ensure Metro resolves symlinked workspace packages
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    ...(config.resolver?.nodeModulesPaths ?? []),
  ],
};

module.exports = config;
