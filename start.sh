#!/bin/sh
npm --prefix web-app install
npm --prefix web-app run build
npx -y serve -s web-app/dist -l ${PORT:-8080}
