#!/bin/sh
cd web-app && NPM_CONFIG_PRODUCTION=false npm install --include=dev && npm run build
npx -y serve -s web-app/dist -l ${PORT:-8080}
