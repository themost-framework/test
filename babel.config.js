/* eslint-disable quotes */
module.exports = function (api) {
    api.cache(false);
    return {
        "sourceMaps": "inline",
        "presets": [
            [
                "@babel/preset-env",
                {
                    "targets": {
                        "node": "current"
                    }
                }
            ]
        ],
        "ignore":  [
            /\/node_modules/
        ],
        "plugins": [
            [
                "@babel/plugin-proposal-decorators",
                {
                    "legacy": true
                }
            ],
            [
                "@babel/plugin-proposal-class-properties"
            ]
        ]
    };
};
