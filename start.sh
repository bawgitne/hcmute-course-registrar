#!/bin/sh
cd web-app && npm install --include=optional --include=dev && npm run build
npx -y serve -s web-app/dist -l ${PORT:-8080}
