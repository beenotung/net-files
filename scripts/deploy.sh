#!/bin/bash
set -e
set -o pipefail

source "./.env"

if [ -z "$HOST" ]; then
  echo "HOST is not set"
  exit 1
fi

if [ -z "$USER" ]; then
  echo "USER is not set"
  exit 1
fi

if [ -z "$PROJECT_DIR" ]; then
  echo "PROJECT_DIR is not set"
  exit 1
fi

npm run build

rsync -SavLPz \
  package.json \
  dist \
	public \
  "$USER@$HOST:$PROJECT_DIR/"

ssh "$USER@$HOST" "
source ~/.nvm/nvm.sh && \
cd $PROJECT_DIR && \
pnpm i --prod --no-optional && \
pm2 reload net-files
"
