#!/usr/bin/env python3
"""Deletes Strimz backups older than 30 days from Cloudinary. Run monthly on your Mac.

Usage: python3 infra/backup/prune.py <cloud name>          # lists what it would delete
       python3 infra/backup/prune.py <cloud name> --delete # deletes it

Asks for the API key and secret with hidden prompts. The newest 7 backups are always kept,
so a run after backups have stopped can't delete the last good ones.
"""

import base64
import getpass
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

PREFIX = "strimz-backups/mainnet/"
KEEP_DAYS = 30
KEEP_NEWEST = 7


def call(method, url, auth):
    req = urllib.request.Request(url, method=method, headers={"Authorization": f"Basic {auth}"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cloud, delete = sys.argv[1], "--delete" in sys.argv[2:]
    key = getpass.getpass("Cloudinary API key: ")
    secret = getpass.getpass("Cloudinary API secret: ")
    auth = base64.b64encode(f"{key}:{secret}".encode()).decode()
    base = f"https://api.cloudinary.com/v1_1/{cloud}/resources/raw/authenticated"

    backups, cursor = [], None
    while True:
        query = {"prefix": PREFIX, "max_results": 500}
        if cursor:
            query["next_cursor"] = cursor
        page = call("GET", f"{base}?{urllib.parse.urlencode(query)}", auth)
        backups += page["resources"]
        cursor = page.get("next_cursor")
        if not cursor:
            break

    backups.sort(key=lambda r: r["created_at"], reverse=True)
    cutoff = datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)
    old = [
        r["public_id"]
        for r in backups[KEEP_NEWEST:]
        if datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")) < cutoff
    ]
    print(f"{len(backups)} backups, {len(old)} older than {KEEP_DAYS} days")
    for public_id in old:
        print(f"  {public_id}")
    if not old or not delete:
        if old:
            print("Nothing deleted. Run again with --delete to delete these.")
        return

    for i in range(0, len(old), 100):
        query = urllib.parse.urlencode([("public_ids[]", p) for p in old[i : i + 100]])
        result = call("DELETE", f"{base}?{query}", auth)
        failed = {p: s for p, s in result["deleted"].items() if s != "deleted"}
        if failed:
            sys.exit(f"Not deleted: {failed}")
    print(f"Deleted {len(old)}.")


if __name__ == "__main__":
    main()
