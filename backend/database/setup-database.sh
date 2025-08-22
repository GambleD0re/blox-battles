#!/bin/bash
# Exit immediately if a command exits with a non-zero status.
set -e

# This script will run the schema.sql file against the database.
# The DATABASE_URL environment variable is automatically provided by Render.
# The path is relative to the project root, where Render executes commands.

echo "--- Running Database Schema Setup ---"

psql $DATABASE_URL -X -f ./backend/database/schema.sql --quiet --single-transaction

echo "--- Database Schema Setup Complete ---"
