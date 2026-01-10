#!/bin/bash
set -e

echo "Rebuilding Docker image with tzdata..."
sudo docker compose build --no-cache

echo "Recreating container..."
sudo docker compose up -d --force-recreate

echo "Verifying timezone..."
sudo docker compose exec quiz-app date
