#!/usr/bin/env python3
"""
Validate the Vite production artifact for GitHub Pages.

Run from the frontend directory:

    python3 ../scripts/validate-pages-dist.py

Expected production layout:

    frontend/
      dist/
        index.html
        assets/
          index-<hash>.js
          index-<hash>.css

Expected public asset prefix:

    /agent-topology-auditor/assets/

This validator checks actual files, not merely strings in the HTML.
"""

from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit
import sys

DIST = Path("dist")
INDEX = DIST / "index.html"
EXPECTED_PREFIX = "/agent-topology-auditor/assets/"


class ProductionHTMLParser(HTMLParser):
    """Collect React root, JavaScript entry, and stylesheet references."""

    def __init__(self):
        super().__init__()
        self.has_root = False
        self.scripts = []
        self.stylesheets = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        tag = tag.lower()

        if tag == "div" and attributes.get("id") == "root":
            self.has_root = True

        if tag == "script":
            source = attributes.get("src")
            if source:
                self.scripts.append(source)

        if tag == "link":
            rel = attributes.get("rel", "").lower().split()
            href = attributes.get("href")

            if href and "stylesheet" in rel:
                self.stylesheets.append(href)


def fail(message):
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def validate_asset(url, expected_extension):
    """
    Resolve a public Pages URL to the corresponding local dist/ file.

    Example:

        URL:
          /agent-topology-auditor/assets/index-ABC.js

        Local file:
          dist/assets/index-ABC.js

    The repository URL prefix is deliberately removed before resolving the
    filesystem path. It must never become a directory beneath dist/.
    """

    parsed = urlsplit(url)

    if parsed.scheme or parsed.netloc:
        fail(f"Expected a local Pages asset URL, received: {url}")

    if not parsed.path.startswith(EXPECTED_PREFIX):
        fail(f"Unexpected Pages asset prefix: {url}")

    relative = parsed.path[len(EXPECTED_PREFIX):]

    if not relative:
        fail(f"Empty asset path: {url}")

    relative_path = PurePosixPath(relative)

    if relative_path.is_absolute() or ".." in relative_path.parts:
        fail(f"Unsafe asset path: {url}")

    if relative_path.suffix.lower() != expected_extension:
        fail(f"Expected {expected_extension} asset: {url}")

    target = DIST.joinpath(*relative_path.parts).resolve()
    resolved_dist = DIST.resolve()

    if resolved_dist not in target.parents:
        fail(f"Asset resolves outside dist/: {url}")

    if not target.is_file():
        fail(f"Referenced production asset does not exist: {target}")

    if target.stat().st_size == 0:
        fail(f"Referenced production asset is empty: {target}")

    print(f"VALID {expected_extension}: {url}")
    print(f"  FILE: {target}")
    print(f"  SIZE: {target.stat().st_size} bytes")


def main():
    if not INDEX.is_file():
        fail("dist/index.html is missing")

    if INDEX.stat().st_size == 0:
        fail("dist/index.html is empty")

    html = INDEX.read_text(encoding="utf-8")

    parser = ProductionHTMLParser()
    parser.feed(html)
    parser.close()

    if not parser.has_root:
        fail("React root div#root is missing")

    if not parser.scripts:
        fail("No JavaScript script entry was found")

    if not parser.stylesheets:
        fail("No CSS stylesheet reference was found")

    for script in parser.scripts:
        validate_asset(script, ".js")

    for stylesheet in parser.stylesheets:
        validate_asset(stylesheet, ".css")

    print("")
    print("PASS: Production HTML, React root, JavaScript, CSS,")
    print("      repository base path, and filesystem assets validated.")


if __name__ == "__main__":
    main()
