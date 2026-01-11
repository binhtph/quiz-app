#!/bin/bash

# Get git commit info
export GIT_COMMIT=$(git rev-parse --short HEAD)
export GIT_COMMIT_FULL=$(git rev-parse HEAD)

echo "Deploying with commit: $GIT_COMMIT"

# Rebuild and restart
docker compose up -d --build
