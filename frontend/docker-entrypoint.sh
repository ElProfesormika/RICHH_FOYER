#!/bin/sh
set -e
API_URL="${VITE_API_BASE_URL:-${API_BASE_URL:-/api}}"
API_URL="${API_URL%/}"
printf 'window.__FOYER_API_BASE__="%s";\n' "$API_URL" > /usr/share/nginx/html/config.js
echo "Foyer_UTT frontend — API: $API_URL"
exec nginx -g 'daemon off;'
