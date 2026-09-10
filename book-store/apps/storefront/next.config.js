const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    const destinations = {
      terms: "terms-of-purchase",
      shipping: "shipping-returns",
      cancellations: "shipping-returns",
      privacy: "privacy-accessibility",
      accessibility: "privacy-accessibility",
    }
    return Object.entries(destinations).flatMap(([source, destination]) =>
      ["", "/:countryCode([a-z]{2})"].flatMap((prefix) =>
        ["", "/pages"].map((pages) => ({
          source: `${prefix}${pages}/${source}`,
          destination: `${prefix ? "/:countryCode" : ""}/pages/${destination}`,
          statusCode: 301,
        })),
      ),
    )
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
