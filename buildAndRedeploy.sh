# bin/bash

# build BE
rm -rf ./be/dist ./be/node_modules
docker build -t mitsosf/operator-suicore-be:latest -f ./be/Dockerfile ./be
docker compose -f ./be/docker-compose.yml down && docker compose -f ./be/docker-compose.yml up -d

# build FE
pnpm run build

