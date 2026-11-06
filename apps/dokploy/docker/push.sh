#!/bin/bash

# Determine the type of build based on the first script argument
BUILD_TYPE=${1:-production}

BUILDER=$(docker buildx create --use)

if [ "$BUILD_TYPE" == "canary" ]; then
    TAG="canary"
    echo PUSHING CANARY
    docker buildx build --platform linux/amd64,linux/arm64 --pull --rm -t "ghcr.io/mike09811/dokploy:${TAG}" -f 'Dockerfile' --push .
else
    echo  "PUSHING PRODUCTION"
    VERSION=$(node -p "require('./package.json').version")
    docker buildx build --platform linux/amd64,linux/arm64 --pull --rm -t "ghcr.io/mike09811/dokploy:latest" -t "ghcr.io/mike09811/dokploy:${VERSION}" -f 'Dockerfile' --push .
fi

docker buildx rm $BUILDER
