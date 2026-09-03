const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

const config = getSentryExpoConfig(__dirname);

// Metro watches the whole npm workspace, which includes the two Next.js apps'
// build output. Next rewrites `.next` constantly while its dev server runs, and
// Metro's crawler hard-crashes ("ENOENT: no such file or directory, watch
// .../apps/admin/.next/static/chunks/app/analytics") when a directory it is
// walking disappears mid-walk — so starting the mobile app while the admin or
// marketing dev server was up came down to a coin flip. Nothing under `.next`
// is ever a module this app imports, so it is kept out of the crawl entirely.
const existingBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList)
    ? existingBlockList
    : existingBlockList
      ? [existingBlockList]
      : []),
  /[/\\]\.next[/\\]/,
];

module.exports = withNativeWind(config, { input: "./src/global.css" });
