'use strict';

/**
 * server/middleware.js
 *
 * Shared Express middleware for the CMS API.
 */

const rateLimit = require('express-rate-limit');

/**
 * General rate limiter for all /cms/* routes (except /cms/auth/login which
 * has its own tighter limiter).
 * 200 requests per minute per IP — generous enough for normal admin use
 * but low enough to mitigate abuse.
 */
const cmsRateLimiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

module.exports = { cmsRateLimiter };
