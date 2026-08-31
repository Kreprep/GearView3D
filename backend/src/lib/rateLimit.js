import { MINUTE, rateLimit } from 'express-rate-limit'

// Login/signup are unthrottled by default, and bcrypt's cost factor makes
// login a cheap CPU-exhaustion target on top of the credential-stuffing risk.
// Keyed on IP (express-rate-limit's default keyGenerator, IPv6-safe) - needs
// app.set('trust proxy', ...) in createApp() so that IP is the real client
// behind Caddy/nginx rather than the proxy for every request alike.
export const authLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
})
