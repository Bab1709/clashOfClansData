"""Download unit and town hall images into public/img.

The Clash of Clans API has no images for troops, heroes, spells or
equipment, so we take them from the open-source clash-of-clans-data
project (https://github.com/chiefpansancolt/clash-of-clans-data) and
shrink them, because some originals are 2048px and 300 KB each.

Resizing uses `sips`, which ships with macOS.

Run:  python3 scripts/download_icons.py
"""

import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = "chiefpansancolt/clash-of-clans-data"
OUT = Path(__file__).resolve().parent.parent / "public" / "img"

# Source folder in the repo -> output folder, and the max size in pixels.
ICON_CATEGORIES = {
    "images/home/heroes": ("heroes", 128),
    "images/home/hero-equipment": ("equipment", 96),
    "images/home/pets": ("pets", 96),
    "images/home/troops": ("troops", 96),
    "images/home/siege-machines": ("siege", 96),
    "images/home/spells": ("spells", 96),
    "images/builder/heroes": ("builder-heroes", 128),
    "images/builder/troops": ("builder-troops", 96),
}
HALLS = {
    "images/home/town-hall/normal": ("town-hall", 192),
    "images/builder/builder-hall/normal": ("builder-hall", 192),
}


def get_json(url):
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def download(*urls):
    """Return the bytes from the first URL that works, or None."""
    for url in urls:
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                return response.read()
        except urllib.error.URLError:
            continue
    return None


def ssl_safe_urlopen_setup():
    # Python from python.org on macOS lacks certificates; use certifi if present.
    try:
        import ssl
        import certifi
        context = ssl.create_default_context(cafile=certifi.where())
        urllib.request.install_opener(urllib.request.build_opener(urllib.request.HTTPSHandler(context=context)))
    except ImportError:
        pass


def main():
    ssl_safe_urlopen_setup()
    sha = get_json(f"https://api.github.com/repos/{REPO}/commits/main")["sha"]
    tree = get_json(f"https://api.github.com/repos/{REPO}/git/trees/{sha}?recursive=1")["tree"]
    paths = [item["path"] for item in tree if item["path"].endswith(".png")]

    jobs = []
    for path in paths:
        folder, _, filename = path.rpartition("/")
        parent, _, slug = folder.rpartition("/")
        if filename == "icon.png" and parent in ICON_CATEGORIES:
            out_dir, size = ICON_CATEGORIES[parent]
            jobs.append((path, OUT / out_dir / f"{slug}.png", size))
        elif folder in HALLS and filename.startswith("level-"):
            out_dir, size = HALLS[folder]
            jobs.append((path, OUT / out_dir / filename.replace("level-", ""), size))

    failed = []
    for i, (path, target, size) in enumerate(jobs, 1):
        if target.exists():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        source = target.with_suffix(".download")
        data = download(
            f"https://cdn.jsdelivr.net/gh/{REPO}@{sha}/{path}",
            f"https://raw.githubusercontent.com/{REPO}/{sha}/{path}",
        )
        if data is None:
            failed.append(path)
            print(f"[{i}/{len(jobs)}] FAILED {path}")
            continue
        source.write_bytes(data)
        # Some ".png" files upstream are really WebP, so convert while resizing.
        subprocess.run(
            ["sips", "-s", "format", "png", "-Z", str(size), str(source), "--out", str(target)],
            check=True, capture_output=True,
        )
        source.unlink()
        print(f"[{i}/{len(jobs)}] {target.relative_to(OUT)}")

    print(f"Done. Images from {REPO}@{sha[:7]}")
    if failed:
        print(f"{len(failed)} image(s) couldn't be downloaded; the site shows a placeholder for them.")


if __name__ == "__main__":
    sys.exit(main())
