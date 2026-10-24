#!/bin/sh
set -e
# Render tells the container which port to listen on.
PORT="${PORT:-80}"
sed -i "s/Listen 80/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/\*:80>/*:${PORT}>/" /etc/apache2/sites-available/000-default.conf
# The sealing server asks the PHP API who is signed in, over localhost.
export SSIS_API="http://127.0.0.1:${PORT}"
node /opt/app/realtime/server.mjs &
exec apache2-foreground
