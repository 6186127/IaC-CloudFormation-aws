#!/usr/bin/env sh
set -eu

echo "Installing dependencies"
npm ci

echo "Running automated tests"
npm test
