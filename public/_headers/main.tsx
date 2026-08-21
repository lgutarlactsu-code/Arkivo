# Security headers for the static site (Cloudflare Pages / Netlify style).
#
# WHY THIS FILE EXISTS:
#   The `secureHeaders` middleware in supabase/functions/server/security.tsx
#   only adds headers to the edge-function API responses (/make-server-*).
#   It cannot set headers on the HTML/JS/CSS served by the static host, so a
#   header scanner hitting the website itself reports them as "Missing".
#   Cloudflare Pages (and Netlify) read this `_headers` file from the build
#   output root — Vite copies everything under public/ to that root — and
#   applies these headers to matching responses.
#
# NOTE: `Server: cloudflare` is added by Cloudflare's own edge and cannot be
#   removed from application code; ignore that one scanner finding.

/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  X-XSS-Protection: 1; mode=block
