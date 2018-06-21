/* global module, require */
module.exports = {
    webpack: (config, { isServer }) => {
        if (!isServer) {
            const IgnorePlugin = require('webpack').IgnorePlugin;
            config.plugins.push(
                new IgnorePlugin(/next\/document/)
            );
        }
        return config;
    }
};
