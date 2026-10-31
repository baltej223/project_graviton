#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

if ! command -v uvicorn >/dev/null 2>&1; then
  echo "Error: uvicorn is not installed or is not on PATH." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or is not on PATH." >&2
  exit 1
fi

if [[ ! -d "$ROOT_DIR/client/node_modules" ]]; then
  echo "Error: client dependencies are missing. Run 'cd client && npm install' first." >&2
  exit 1
fi

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi

  wait "${BACKEND_PID:-}" 2>/dev/null || true
  wait "${FRONTEND_PID:-}" 2>/dev/null || true
  exit "$exit_code"
}

trap cleanup EXIT
trap 'exit 130' INT TERM

(
  cd "$ROOT_DIR/backend"
  exec uvicorn app.main:app \
    --reload \
    --host "$BACKEND_HOST" \
    --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

(
  cd "$ROOT_DIR/client"
  exec npm run dev -- \
    --host "$FRONTEND_HOST" \
    --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

echo "Backend:  http://${BACKEND_HOST}:${BACKEND_PORT}"
echo "Frontend: http://${FRONTEND_HOST}:${FRONTEND_PORT}"
echo "Press Ctrl+C to stop both services."

wait -n "$BACKEND_PID" "$FRONTEND_PID"
