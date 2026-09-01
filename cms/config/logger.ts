import { winston, formats } from '@strapi/logger'

/**
 * Strapi's default Console transport writes every level to stdout only, so
 * systemd's `StandardError=append:/var/log/strapi/error.log` never sees our
 * formatted logs — only untimestamped raw Node crash dumps. This adds a
 * second Console transport that routes error-level logs to stderr (with
 * ANSI colour codes stripped, since the destination is a file) so
 * error.log gets Strapi's timestamped error output.
 */
export default {
  transports: [
    new winston.transports.Console(),
    // Creates a second error scoped Console transport that will ensure stderr logs will be timestamped
    // and formatted correctly. This is required for systemd to be able to capture the logs in a file.
    new winston.transports.Console({
      level: 'error',
      stderrLevels: ['error'],
      format: formats.excludeColors
    })
  ]
}
