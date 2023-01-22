#!/usr/bin/env bash

# We'll want to clean up the services/web/project/static/parses directory when this is ran

# Set this variable to where this script is housed
SELF_DIR="/home/mja00/paper-log-parser"

DIR_TO_CLEAN="${SELF_DIR}/services/web/project/static/parses"

# Delete all the pngs in the directory
find "${DIR_TO_CLEAN}" -type f -name "*.png" -delete

