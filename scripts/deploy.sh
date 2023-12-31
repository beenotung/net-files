#!/bin/bash
set -e
set -o pipefail

npm run build

source .env

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
