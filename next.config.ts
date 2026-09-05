import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : undefined;

const nextConfig: NextConfig = {
  // takumi-pdf ships a native Node.js binding + a separate browser/wasm
  // build behind conditional package.json exports; letting the bundler
  // (Turbopack) try to statically resolve/bundle it picks the wrong (wasm)
  // branch and fails to build. Excluding it makes Next.js `require()` it
  // at runtime instead, like any other native-binding server dependency.
  serverExternalPackages: ["takumi-pdf"],
  images: {
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
});
