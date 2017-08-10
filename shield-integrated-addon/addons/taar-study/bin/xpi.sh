#!/usr/bin/env bash

echo $@

set -eu
#set -o xtrace

BASE_DIR="$(dirname "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")"
TMP_DIR=$(mktemp -d)
DEST="${TMP_DIR}/addon"
XPI=${XPI:-addon.xpi}

echo "$XPI"

mkdir -p "$DEST"

# deletes the temp directory
function cleanup {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# fill templates, could be fancier
echo $PWD
alias moustache='/node_modules/bin/mustache'
mustache package.json template/install.rdf.mustache > addon/install.rdf
mustache package.json template/chrome.manifest.mustache > addon/chrome.manifest

cp -rp addon/* "$DEST"

pushd "$DEST"
zip -r "$DEST/${XPI}" *	-x@"$BASE_DIR/.xpiignore"
mkdir -p "$BASE_DIR/dist"
mv "${XPI}" "$BASE_DIR/dist"
echo "xpi at ${BASE_DIR}/dist/${XPI}"
popd

