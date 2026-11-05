#!/bin/bash
# Changes the app's identity everywhere in one go, for when Xcode says the
# bundle identifier is "not available" (someone else already uses it).
#
#     ios/tools/set_bundle_id.sh com.yourname.alexhq
#
# Use letters, numbers and dots only. The widget becomes <id>.widgets and the
# shared storage area becomes group.<id>.
set -e
NEW="$1"
if [[ -z "$NEW" || ! "$NEW" =~ ^[A-Za-z0-9]+(\.[A-Za-z0-9]+)+$ ]]; then
  echo "Give an id like com.yourname.alexhq (letters, numbers and dots)"; exit 1
fi
cd "$(dirname "$0")/.."
OLD=$(grep -o 'group\.[A-Za-z0-9.]*' Shared/SharedStore.swift | head -1 | sed 's/^group\.//')
perl -pi -e "s/\Q$OLD\E/$NEW/g" \
  AlexHQ.xcodeproj/project.pbxproj AlexHQ/AlexHQ.entitlements \
  AlexHQWidgets/AlexHQWidgets.entitlements Shared/SharedStore.swift
echo "Changed $OLD -> $NEW. Close and reopen the project in Xcode."
