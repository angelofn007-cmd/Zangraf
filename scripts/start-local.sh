#!/bin/zsh
set -eu
cd "$(dirname "$0")/.."

zangraf_node="$(command -v node || true)"
if [[ -z "$zangraf_node" ]]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; do
    if [[ -x "$candidate" ]]; then zangraf_node="$candidate"; break; fi
  done
fi
if [[ -z "$zangraf_node" ]]; then
  print 'Instale o Node.js 24 e execute esta tarefa novamente.'
  exit 1
fi
if [[ ! -f node_modules/next/dist/bin/next ]]; then
  print 'Instale as dependências com pnpm install --frozen-lockfile.'
  exit 1
fi
export PATH="$(dirname "$zangraf_node"):$PATH"
print 'Zangraf local: http://127.0.0.1:3000 — mantenha este terminal aberto.'
exec "$zangraf_node" node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3000
