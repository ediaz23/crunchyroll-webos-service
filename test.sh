#!/bin/sh

for i in v8.12.0 v12.21.0 v12.22.2 v16.19.1;
do
    echo "$i"
    ~/.nvm/versions/node/$i/bin/node node_modules/.bin/jest --silent
    echo ""
done
