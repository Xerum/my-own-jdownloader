#!/usr/bin/env bash
# Click through every screen of the web UI against the throw-away JD test devices (devices/) and report
# any JS error. Starts the test devices and the app if they are not already up.
#   testing/run.sh            run the check
#   testing/run.sh install    npm install inside the ui-test image (after editing testing/package.json)
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" == "install" ]]; then
  docker compose --profile test run --rm ui-test npm install
  exit 0
fi

testing/devices/run.sh up
docker compose up -d --build app
docker compose --profile test run --rm ui-test npm start
