#!/usr/bin/env bash
cd ~/front-end || exit 1
export PATH="/home/sahil/.nvm/versions/node/v20.20.2/bin:$PATH"
exec npm run dev > /tmp/nextdev.log 2>&1
