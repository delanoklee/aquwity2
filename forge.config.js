const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const packagerConfig = {
  asar: true,
  icon: './icons/icon',
  ignore: [
    /^\/website$/,
    /^\/\.git$/,
    /^\/\.gitignore$/,
    /^\/slider\.png$/,
  ],
};

// Only add signing/notarization when credentials are available (CI)
if (process.env.APPLE_SIGNING_IDENTITY) {
  packagerConfig.osxSign = {
    identity: process.env.APPLE_SIGNING_IDENTITY,
    'hardened-runtime': true,
    entitlements: 'entitlements.mac.plist',
    'entitlements-inherit': 'entitlements.mac.plist',
  };
  packagerConfig.osxNotarize = {
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  };
}

module.exports = {
  packagerConfig,
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'aquwity',
        setupExe: 'aquwity.exe',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: './icons/icon.png',
        },
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        icon: './icons/icon.png',
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'delanoklee',
          name: 'aquwity2',
        },
        prerelease: false,
        draft: false,
      },
    },
  ],
};
