#!/usr/bin/env bash
# ==============================================================================
# AGENT TOPOLOGY AUDITOR — ONE-SHOT GITHUB PAGES BUILD AND DEPLOYMENT
#
# File:
#   scripts/build-and-deploy-pages.sh
#
# Version:
#   6.0.0
#
# Purpose:
#   Repair and maintain the GitHub Pages production build pipeline.
#
# Repository:
#   swipswaps/agent-topology-auditor
#
# Public site:
#   https://swipswaps.github.io/agent-topology-auditor/
#
# This script:
#   1. Validates the repository, branch, GitHub authentication, and dependencies.
#   2. Creates a timestamped backup before changing repository files.
#   3. Writes the reusable production asset validator.
#   4. Writes the repository's README.txt operating documentation.
#   5. Patches only the existing GitHub Actions validation step.
#   6. Adds documentation/script paths to the workflow's push filters.
#   7. Installs locked npm dependencies.
#   8. Builds the frontend with Vite.
#   9. Runs the same validator locally that GitHub Actions runs.
#  10. Commits only the intended repository files.
#  11. Pushes without force-pushing.
#  12. Waits for the Actions run associated with the exact commit.
#  13. Checks the published HTML, JavaScript, and CSS responses.
#
# It does NOT:
#   - Replace the entire GitHub Actions workflow.
#   - Rewrite React application components.
#   - Rewrite the Three.js visualization.
#   - Change the Vite base path.
#   - Modify unrelated staged or tracked files.
#   - Force-push.
#   - Claim that HTTP 200 proves the browser rendered React successfully.
#
# Usage:
#   bash scripts/build-and-deploy-pages.sh
#
# Run from any working directory. The repository root is derived from this
# script's own location.
#
# Exit codes are intentionally explicit. No "set -e" is used.
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)" || return 10
REPOSITORY="swipswaps/agent-topology-auditor"
BRANCH="main"
PAGES_URL="https://swipswaps.github.io/agent-topology-auditor/"
WORKFLOW_REL=".github/workflows/deploy.yml"
VALIDATOR_REL="scripts/validate-pages-dist.py"
SCRIPT_REL="scripts/build-and-deploy-pages.sh"
README_REL="README.txt"

WORKFLOW_PATH="$PROJECT_ROOT/$WORKFLOW_REL"
VALIDATOR_PATH="$PROJECT_ROOT/$VALIDATOR_REL"
SCRIPT_PATH="$PROJECT_ROOT/$SCRIPT_REL"
README_PATH="$PROJECT_ROOT/$README_REL"

TIMESTAMP="$(date '+%Y%m%d_%H%M%S')_$$"
BACKUP_DIR="$PROJECT_ROOT/.git/repair-backups/$TIMESTAMP"

TEMP_FILES=()
COMMIT_CREATED=0
COMMIT_SHA=""
RUN_ID=""
ASSET_LIST=""

# ------------------------------------------------------------------------------
# Temporary-file cleanup.
#
# All temporary files are registered in TEMP_FILES. The EXIT trap removes
# only those files created by this execution. It never removes repository
# files, build output, backups, or user data.
# ------------------------------------------------------------------------------

cleanup() {
    local item

    for item in "${TEMP_FILES[@]}"; do
        if [[ -f "$item" ]]; then
            unlink "$item"
        fi
    done
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

fail() {
    printf '\n[ERROR] %s\n' "$1" >&2
    return "${2:-1}"
}

make_temp() {
    local prefix="$1"
    local result

    result="$(mktemp "$prefix")" || return 1
    TEMP_FILES+=("$result")
    printf '%s' "$result"
}

# ------------------------------------------------------------------------------
# Install a generated file only if its contents differ.
#
# This is the central idempotency mechanism:
#   - Identical content is left untouched.
#   - Changed content is backed up first.
#   - Replacement is atomic within the target directory.
# ------------------------------------------------------------------------------

install_generated_file() {
    local temporary="$1"
    local destination="$2"
    local backup_name="$3"

    if [[ -f "$destination" ]] && cmp -s "$temporary" "$destination"; then
        printf '[UNCHANGED] %s\n' "${destination#"$PROJECT_ROOT"/}"
        unlink "$temporary"
        return 0
    fi

    if [[ -e "$destination" ]]; then
        if ! cp -p "$destination" "$BACKUP_DIR/$backup_name"; then
            fail "Could not back up $destination" 30
            return 30
        fi
        printf '[BACKUP] %s\n' "$BACKUP_DIR/$backup_name"
    fi

    if ! mv "$temporary" "$destination"; then
        fail "Could not install $destination" 31
        return 31
    fi

    printf '[UPDATED] %s\n' "${destination#"$PROJECT_ROOT"/}"
    return 0
}

printf '\n============================================================\n'
printf '[START] Agent Topology Auditor build/deploy v6.0.0\n'
printf '============================================================\n'
printf '[PROJECT] %s\n' "$PROJECT_ROOT"
printf '[REPOSITORY] %s\n' "$REPOSITORY"
printf '[PAGES] %s\n' "$PAGES_URL"

# ------------------------------------------------------------------------------
# 1. Preflight required commands.
# ------------------------------------------------------------------------------

for required in \
    git gh node npm python3 jq curl awk cmp mktemp cp mv mkdir \
    date sleep seq unlink
do
    if ! command -v "$required"; then
        fail "Required command is unavailable: $required" 40
        return 40
    fi
done

# ------------------------------------------------------------------------------
# 2. Verify repository structure.
# ------------------------------------------------------------------------------

for required_file in \
    .git \
    frontend/package.json \
    frontend/package-lock.json \
    frontend/index.html \
    frontend/vite.config.js \
    frontend/src/main.jsx \
    .github/workflows/deploy.yml
do
    if [[ ! -e "$PROJECT_ROOT/$required_file" ]]; then
        fail "Required project file is missing: $required_file" 41
        return 41
    fi
done

# ------------------------------------------------------------------------------
# 3. Verify GitHub identity and repository access.
# ------------------------------------------------------------------------------

if ! gh auth status; then
    fail "GitHub CLI authentication is unavailable." 42
    return 42
fi

GH_LOGIN="$(gh api user --jq '.login')" || {
    fail "Could not retrieve authenticated GitHub username." 43
    return 43
}

if [[ "$GH_LOGIN" != "swipswaps" ]]; then
    fail "Expected GitHub account swipswaps; authenticated account is $GH_LOGIN." 44
    return 44
fi

if ! gh repo view "$REPOSITORY" --json nameWithOwner --jq '.nameWithOwner'; then
    fail "Cannot access target repository." 45
    return 45
fi

# ------------------------------------------------------------------------------
# 4. Verify origin and branch.
# ------------------------------------------------------------------------------

ORIGIN_URL="$(git -C "$PROJECT_ROOT" remote get-url origin)" || {
    fail "Git origin is missing." 46
    return 46
}

case "$ORIGIN_URL" in
    https://github.com/swipswaps/agent-topology-auditor.git | \
    https://github.com/swipswaps/agent-topology-auditor | \
    git@github.com:swipswaps/agent-topology-auditor.git)
        printf '[OK] Git origin is correct.\n'
        ;;
    *)
        fail "Unexpected Git origin: $ORIGIN_URL" 47
        return 47
        ;;
esac

CURRENT_BRANCH="$(git -C "$PROJECT_ROOT" branch --show-current)"

if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
    fail "Expected branch $BRANCH; current branch is $CURRENT_BRANCH." 48
    return 48
fi

# ------------------------------------------------------------------------------
# 5. Protect unrelated local work.
#
# Existing changes to the intended files are permitted because this script
# maintains those files. Changes elsewhere are not.
#
# Existing staged changes are never committed by this script.
# ------------------------------------------------------------------------------

if ! git -C "$PROJECT_ROOT" diff --cached --quiet; then
    git -C "$PROJECT_ROOT" status --short
    fail "Git index already contains staged changes. Resolve them first." 49
    return 49
fi

while IFS= read -r changed_file; do
    case "$changed_file" in
        "$WORKFLOW_REL" | "$VALIDATOR_REL" | "$SCRIPT_REL" | "$README_REL")
            printf '[INFO] Existing intended-file modification: %s\n' "$changed_file"
            ;;
        "")
            ;;
        *)
            git -C "$PROJECT_ROOT" status --short
            fail "Unrelated tracked modification detected: $changed_file" 50
            return 50
            ;;
    esac
done < <(git -C "$PROJECT_ROOT" diff --name-only)

# ------------------------------------------------------------------------------
# 6. Ensure local main starts synchronized with remote main.
# ------------------------------------------------------------------------------

printf '\n[GIT] Fetching origin/main...\n'

if ! git -C "$PROJECT_ROOT" fetch origin "$BRANCH"; then
    fail "Could not fetch origin/main." 51
    return 51
fi

LOCAL_START_SHA="$(git -C "$PROJECT_ROOT" rev-parse HEAD)" || return 52
REMOTE_START_SHA="$(git -C "$PROJECT_ROOT" rev-parse "origin/$BRANCH")" || return 53

if [[ "$LOCAL_START_SHA" != "$REMOTE_START_SHA" ]]; then
    printf '[LOCAL]  %s\n' "$LOCAL_START_SHA"
    printf '[REMOTE] %s\n' "$REMOTE_START_SHA"
    fail "Local main and origin/main differ. Reconcile Git history before running." 54
    return 54
fi

printf '[OK] Local main matches origin/main.\n'

# ------------------------------------------------------------------------------
# 7. Create backup directory.
# ------------------------------------------------------------------------------

if ! mkdir -p "$BACKUP_DIR"; then
    fail "Could not create backup directory." 55
    return 55
fi

printf '[BACKUP DIRECTORY] %s\n' "$BACKUP_DIR"

# ------------------------------------------------------------------------------
# 8. Generate the reusable production asset validator.
#
# The validator uses Python's HTMLParser instead of fragile regular
# expressions. It checks:
#   - dist/index.html exists and is nonempty.
#   - A React root element exists.
#   - At least one JavaScript entry is referenced.
#   - At least one stylesheet is referenced.
#   - Every asset uses the GitHub Pages repository base path.
#   - Each URL maps to an existing file beneath dist/.
#   - No path traversal is allowed.
# ------------------------------------------------------------------------------

TEMP_VALIDATOR="$(make_temp "$PROJECT_ROOT/scripts/.validator.XXXXXX")" || return 56

cat > "$TEMP_VALIDATOR" <<'PYTHON'
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
PYTHON

if ! install_generated_file "$TEMP_VALIDATOR" "$VALIDATOR_PATH" "validate-pages-dist.py.original"; then
    return 57
fi

# ------------------------------------------------------------------------------
# 9. Generate the repository README.txt.
#
# The documentation describes the actual executable script, the workflow,
# validation logic, expected output, failure handling, rollback, and limits.
# ------------------------------------------------------------------------------

TEMP_README="$(make_temp "$PROJECT_ROOT/.README.txt.XXXXXX")" || return 58

cat > "$TEMP_README" <<'README'
AGENT TOPOLOGY AUDITOR
======================

GitHub Pages build, validation, and deployment operations
Documentation version: 6.0.0

REPOSITORY
----------

https://github.com/swipswaps/agent-topology-auditor

PUBLIC SITE
-----------

https://swipswaps.github.io/agent-topology-auditor/

PURPOSE
-------

This repository includes a repeatable, one-shot production build and
deployment script for the frontend hosted on GitHub Pages.

The primary operational script is:

    scripts/build-and-deploy-pages.sh

The production artifact validator is:

    scripts/validate-pages-dist.py

The deployment workflow is:

    .github/workflows/deploy.yml

The workflow publishes the Vite production directory:

    frontend/dist/

RUNNING THE BUILD AND DEPLOYMENT
--------------------------------

From the repository root:

    bash scripts/build-and-deploy-pages.sh

The script derives the repository root from its own location. It does not
depend on the shell's current working directory.

The script performs the following operations:

1. Checks required commands and GitHub CLI authentication.
2. Confirms the authenticated GitHub account is swipswaps.
3. Confirms the origin URL and main branch.
4. Checks that local main matches origin/main before making changes.
5. Refuses to commit pre-existing staged changes.
6. Refuses unrelated tracked modifications.
7. Creates a timestamped backup directory under:

       .git/repair-backups/

8. Installs or updates scripts/validate-pages-dist.py.
9. Installs or updates this README.txt.
10. Patches the existing GitHub Actions validation step without replacing
    the entire workflow.
11. Adds scripts/** and README.txt to the workflow's push path filters.
12. Installs dependencies using npm ci and package-lock.json.
13. Runs npm run build.
14. Validates the production artifact locally.
15. Stages only the intended script, validator, README, and workflow files.
16. Commits only when those files actually changed.
17. Pushes without force-pushing.
18. Waits for the GitHub Actions run associated with the exact commit.
19. Checks the public HTML, JavaScript, and CSS HTTP responses.

IDEMPOTENCY
-----------

The script compares generated files before replacing them.

If a generated file is byte-for-byte identical, it is left untouched.

If no intended repository file changed:

- No empty Git commit is created.
- No unnecessary push is performed.
- The deployment workflow is manually dispatched so that a fresh build and
  deployment can still be requested.

The script does not stage arbitrary files from the repository.

It does not use git push --force or git push --force-with-lease.

VITE AND GITHUB PAGES ASSET PATHS
---------------------------------

The Vite project is configured for this project-site base:

    /agent-topology-auditor/

The source entry in frontend/index.html is:

    /src/main.jsx

Vite transforms that source entry during the production build.

The resulting public JavaScript and CSS references should begin with:

    /agent-topology-auditor/assets/

For example:

    /agent-topology-auditor/assets/index-<hash>.js
    /agent-topology-auditor/assets/index-<hash>.css

The corresponding local files are:

    frontend/dist/assets/index-<hash>.js
    frontend/dist/assets/index-<hash>.css

The repository URL prefix is not a directory beneath dist/.

The validator removes the URL prefix before resolving the local filesystem
path. It also rejects path traversal and references to files outside dist/.

PRODUCTION VALIDATION
---------------------

The reusable validator uses Python's HTMLParser rather than regular
expressions to inspect HTML attributes.

Run it manually after a production build:

    cd frontend
    python3 ../scripts/validate-pages-dist.py

It checks:

- dist/index.html exists and is nonempty.
- The React root div#root exists.
- A JavaScript entry point is referenced.
- A CSS stylesheet is referenced.
- Asset URLs use the expected GitHub Pages prefix.
- Every referenced JavaScript file exists.
- Every referenced stylesheet exists.
- Referenced assets are nonempty.
- Asset paths remain beneath dist/.

The same validator is invoked by GitHub Actions.

GITHUB ACTIONS
--------------

The workflow is:

    .github/workflows/deploy.yml

Its high-level stages are:

    Checkout
       |
       v
    Configure GitHub Pages
       |
       v
    Set up Node.js
       |
       v
    npm ci
       |
       v
    npm run build
       |
       v
    Validate generated HTML and assets
       |
       v
    Upload frontend/dist
       |
       v
    Deploy GitHub Pages artifact

The script preserves the existing action versions and workflow deployment
permissions. It does not replace the workflow's entire contents.

The workflow's push filters include:

    frontend/**
    scripts/**
    README.txt
    .github/workflows/deploy.yml

This ensures changes to the reusable validator and deployment documentation
can trigger the workflow.

BACKUPS
-------

Every changed pre-existing file is backed up under:

    .git/repair-backups/<timestamp>/

The script itself is backed up by the installation command before the
repository script is replaced.

Do not delete backup directories until the repair has been verified.

FAILURE HANDLING
----------------

If npm ci fails:

- No commit or push is performed.

If Vite build fails:

- No commit or push is performed.

If the production validator fails:

- No commit or push is performed.

If GitHub Actions fails:

- The script prints the workflow run ID and a command for retrieving logs.

Retrieve the complete log for a failed run:

    gh run view RUN_ID --repo swipswaps/agent-topology-auditor --log

List recent workflow runs:

    gh run list --repo swipswaps/agent-topology-auditor \
        --workflow deploy.yml --branch main

Inspect the current Git state:

    git status --short
    git log -5 --oneline --decorate

ROLLBACK
--------

The script never force-pushes.

To reverse a completed repair commit, use git revert with the exact commit
SHA, after reviewing the changes:

    git revert COMMIT_SHA

Do not reset or rewrite shared main history to undo a published repair.

The original files are also preserved in the timestamped backup directory.

WHAT SUCCESS MEANS
------------------

A successful script run establishes that:

- The local Vite production build completed.
- The production HTML and referenced local assets passed validation.
- The GitHub Actions workflow completed successfully.
- The public HTML returned HTTP 200.
- The public JavaScript asset returned HTTP 200 with a JavaScript MIME type.
- The public CSS asset returned HTTP 200 with a CSS MIME type.

WHAT SUCCESS DOES NOT PROVE
---------------------------

HTTP 200 responses do not prove that the browser executed React successfully.

They do not prove that:

- WebGL is available.
- Three.js initialized successfully.
- D3 visualizations rendered.
- API/backend requests succeeded.
- Browser extensions did not interfere.
- The application has no runtime exceptions.

A browser test is still needed for those conditions.

For a visual/runtime test, open:

    https://swipswaps.github.io/agent-topology-auditor/

Then inspect browser Developer Tools:

    Console
    Network
    Application

Check for JavaScript exceptions, failed requests, MIME errors, mixed-content
errors, and WebGL initialization errors.

LOCAL REQUIREMENTS
------------------

The build/deploy script requires:

    git
    gh
    node
    npm
    python3
    jq
    curl
    awk
    cmp
    mktemp
    cp
    mv
    mkdir
    date
    sleep
    seq
    unlink

The GitHub CLI must already be authenticated as:

    swipswaps

The project must have a valid frontend/package-lock.json.

The script does not install operating-system packages or request root access.

MAINTENANCE
-----------

The build script and validator are intended to be maintained in Git.

When changing the build process:

1. Review the current workflow before editing it.
2. Preserve existing permissions and deployment environment settings.
3. Verify the Vite base path.
4. Build locally.
5. Run the production validator.
6. Review git diff and git diff --check.
7. Run the one-shot build/deploy script.
8. Inspect the exact GitHub Actions run.
9. Check the published asset responses.
10. Perform a browser rendering test.

END
---
README
if ! install_generated_file "$TEMP_README" "$README_PATH" "README.txt.original"; then
    return 59
fi

# ------------------------------------------------------------------------------
# 10. Patch the existing workflow, not the entire file.
#
# The patcher:
#   - Locates the existing named validation step.
#   - Replaces only that step with a call to the repository validator.
#   - Adds scripts/** and README.txt to the existing push paths.
#   - Preserves all action versions, permissions, concurrency, jobs, and
#     deployment environment configuration.
#   - Fails rather than guessing if the expected workflow structure is absent.
# ------------------------------------------------------------------------------

printf '\n[WORKFLOW] Patching existing validation step...\n'

TEMP_WORKFLOW="$(make_temp "$PROJECT_ROOT/.deploy.yml.XXXXXX")" || return 60

if ! python3 - "$WORKFLOW_PATH" "$TEMP_WORKFLOW" <<'PYTHON'
from pathlib import Path
import re
import sys

source = Path(sys.argv[1])
destination = Path(sys.argv[2])

lines = source.read_text(encoding="utf-8").splitlines(keepends=True)

step_name = "      - name: Validate generated entry point and assets"
start = None
end = None

for index, line in enumerate(lines):
    if line.rstrip("\r\n") == step_name:
        start = index
        break

if start is None:
    raise SystemExit(
        "ERROR: Expected existing validation step was not found. "
        "Refusing to replace or reconstruct the entire workflow."
    )

for index in range(start + 1, len(lines)):
    if re.match(r"^      - name:", lines[index]):
        end = index
        break

if end is None:
    end = len(lines)

replacement = [
    "      - name: Validate generated entry point and assets\n",
    "        working-directory: frontend\n",
    "        run: python3 ../scripts/validate-pages-dist.py\n",
]

lines[start:end] = replacement

# Add the validator and documentation to the existing push path filters.
# This preserves existing path entries and does not duplicate entries.
paths_index = None

for index, line in enumerate(lines):
    if re.fullmatch(r"    paths:\s*(?:#.*)?\r?\n?", line):
        paths_index = index
        break

if paths_index is None:
    raise SystemExit(
        "ERROR: Existing push paths filter was not found. "
        "Refusing to change workflow triggers implicitly."
    )

list_end = paths_index + 1

while list_end < len(lines) and re.match(r"^      - ", lines[list_end]):
    list_end += 1

existing_paths = "".join(lines[paths_index + 1:list_end])

for new_path in ('      - "scripts/**"\n', '      - "README.txt"\n'):
    value = new_path.strip().split('"')[1]

    if value not in existing_paths:
        lines.insert(list_end, new_path)
        list_end += 1
        existing_paths += new_path

result = "".join(lines)

if "python3 ../scripts/validate-pages-dist.py" not in result:
    raise SystemExit("ERROR: Validator invocation missing after patch")

if '      - "scripts/**"' not in result:
    raise SystemExit("ERROR: scripts/** workflow trigger missing")

if '      - "README.txt"' not in result:
    raise SystemExit("ERROR: README.txt workflow trigger missing")

destination.write_text(result, encoding="utf-8")
print("PASS: Existing validation step patched.")
print("PASS: scripts/** and README.txt push filters present.")
print("PASS: Other workflow sections preserved.")
PYTHON
then
    fail "Workflow patch failed. No workflow replacement was performed." 61
    return 61
fi

if ! install_generated_file "$TEMP_WORKFLOW" "$WORKFLOW_PATH" "deploy.yml.original"; then
    return 62
fi

# ------------------------------------------------------------------------------
# 11. Verify the Vite base and source entry.
# ------------------------------------------------------------------------------

printf '\n[CHECK] Verifying Vite project-site configuration...\n'

if ! python3 - "$PROJECT_ROOT/frontend/vite.config.js" "$PROJECT_ROOT/frontend/index.html" <<'PYTHON'
from pathlib import Path
import sys

vite = Path(sys.argv[1]).read_text(encoding="utf-8")
html = Path(sys.argv[2]).read_text(encoding="utf-8")

if "base: '/agent-topology-auditor/'" not in vite:
    raise SystemExit("ERROR: Expected Vite base path is missing")

if 'src="/src/main.jsx"' not in html:
    raise SystemExit("ERROR: Expected Vite source entry /src/main.jsx is missing")

print("PASS: Vite base and source entry are correct.")
PYTHON
then
    fail "Vite base/source entry validation failed." 63
    return 63
fi

# ------------------------------------------------------------------------------
# 12. Install locked dependencies.
# ------------------------------------------------------------------------------

printf '\n[BUILD 1/4] Installing locked npm dependencies...\n'

if ! (cd "$PROJECT_ROOT/frontend" && npm ci --no-audit --no-fund); then
    fail "npm ci failed. No commit or push performed." 64
    return 64
fi

# ------------------------------------------------------------------------------
# 13. Build production frontend.
# ------------------------------------------------------------------------------

printf '\n[BUILD 2/4] Running Vite production build...\n'

if ! (cd "$PROJECT_ROOT/frontend" && npm run build); then
    fail "Vite production build failed. No commit or push performed." 65
    return 65
fi

# ------------------------------------------------------------------------------
# 14. Run the same validator that GitHub Actions will run.
# ------------------------------------------------------------------------------

printf '\n[BUILD 3/4] Validating local production assets...\n'

if ! (cd "$PROJECT_ROOT/frontend" && python3 ../scripts/validate-pages-dist.py); then
    fail "Local production asset validation failed. No commit or push performed." 66
    return 66
fi

# ------------------------------------------------------------------------------
# 15. Check workflow and repository whitespace.
# ------------------------------------------------------------------------------

if ! git -C "$PROJECT_ROOT" diff --check; then
    fail "Git whitespace validation failed." 67
    return 67
fi

# ------------------------------------------------------------------------------
# 16. Stage only the intended files.
#
# No broad git add is used.
# ------------------------------------------------------------------------------

printf '\n[GIT] Staging intended files...\n'

if ! git -C "$PROJECT_ROOT" add \
    "$WORKFLOW_REL" \
    "$VALIDATOR_REL" \
    "$SCRIPT_REL" \
    "$README_REL"
then
    fail "Could not stage intended repository files." 68
    return 68
fi

git -C "$PROJECT_ROOT" diff --cached --stat

# ------------------------------------------------------------------------------
# 17. Commit only if the staged content actually differs.
# ------------------------------------------------------------------------------

if ! git -C "$PROJECT_ROOT" diff --cached --quiet; then
    printf '\n[GIT] Creating deployment repair commit...\n'

    if ! git -C "$PROJECT_ROOT" commit \
        -m "Fix Pages asset validation and document one-shot deployment"
    then
        fail "Git commit failed." 69
        return 69
    fi

    COMMIT_CREATED=1
else
    printf '[UNCHANGED] No repository changes require a commit.\n'
fi

COMMIT_SHA="$(git -C "$PROJECT_ROOT" rev-parse HEAD)" || return 70

printf '[COMMIT] %s\n' "$COMMIT_SHA"

# ------------------------------------------------------------------------------
# 18. Check remote history before pushing.
# ------------------------------------------------------------------------------

printf '\n[GIT] Checking remote history before push...\n'

if ! git -C "$PROJECT_ROOT" fetch origin "$BRANCH"; then
    fail "Could not fetch origin/main before push." 71
    return 71
fi

if ! git -C "$PROJECT_ROOT" merge-base --is-ancestor "origin/$BRANCH" HEAD; then
    fail "Remote main is not an ancestor of local HEAD. No force push attempted." 72
    return 72
fi

# ------------------------------------------------------------------------------
# 19. Push only if this execution created a new commit.
# ------------------------------------------------------------------------------

if [[ "$COMMIT_CREATED" -eq 1 ]]; then
    printf '\n[GIT] Pushing tested commit...\n'

    if ! git -C "$PROJECT_ROOT" push origin "$BRANCH"; then
        fail "Git push failed. No force push was attempted." 73
        return 73
    fi

    printf '[OK] Push completed.\n'
else
    printf '[INFO] No new commit; deployment will be manually dispatched.\n'
fi

# ------------------------------------------------------------------------------
# 20. Dispatch if there was no push-triggered run.
#
# A new commit changes the workflow, scripts, or README, all of which are
# included in the workflow's push path filters. Therefore a push-triggered
# workflow is expected.
#
# A no-change rerun explicitly dispatches the workflow.
# ------------------------------------------------------------------------------

if [[ "$COMMIT_CREATED" -eq 0 ]]; then
    printf '\n[ACTIONS] Dispatching deployment workflow...\n'

    if ! gh workflow run deploy.yml --repo "$REPOSITORY" --ref "$BRANCH"; then
        fail "Could not manually dispatch deploy.yml." 74
        return 74
    fi
fi

# ------------------------------------------------------------------------------
# 21. Locate the workflow run for this exact commit.
# ------------------------------------------------------------------------------

printf '\n[ACTIONS] Waiting for run matching commit %s...\n' "$COMMIT_SHA"

for attempt in $(seq 1 60); do
    RUN_JSON="$(gh run list \
        --repo "$REPOSITORY" \
        --workflow deploy.yml \
        --branch "$BRANCH" \
        --limit 50 \
        --json databaseId,headSha,status,conclusion)"

    if [[ "$?" -eq 0 ]]; then
        RUN_ID="$(printf '%s' "$RUN_JSON" |
            jq -r --arg sha "$COMMIT_SHA" \
            '[.[] | select(.headSha == $sha)] |
             sort_by(.databaseId) |
             last |
             .databaseId // empty')"
    fi

    if [[ -n "$RUN_ID" ]]; then
        break
    fi

    printf '[WAIT] Matching run not yet listed (%s/60).\n' "$attempt"
    sleep 5
done

if [[ -z "$RUN_ID" ]]; then
    fail "No Actions run found for commit $COMMIT_SHA." 75
    return 75
fi

printf '[ACTIONS] Run ID: %s\n' "$RUN_ID"

# ------------------------------------------------------------------------------
# 22. Watch the exact workflow run.
# ------------------------------------------------------------------------------

if ! gh run watch "$RUN_ID" --repo "$REPOSITORY" --exit-status; then
    printf '\n[ERROR] GitHub Actions deployment failed.\n' >&2
    printf '[ACTION] Retrieve complete logs with:\n'
    printf 'gh run view %s --repo %s --log\n' "$RUN_ID" "$REPOSITORY"
    printf '[BACKUP] %s\n' "$BACKUP_DIR"
    return 76
fi

printf '[OK] GitHub Actions build and deployment completed.\n'

# ------------------------------------------------------------------------------
# 23. Verify public HTML.
#
# A cache-busting query helps avoid treating an older cached HTML response as
# proof that the latest deployment has propagated.
# ------------------------------------------------------------------------------

TEMP_HTML="$(make_temp "$PROJECT_ROOT/.pages-live-html.XXXXXX")" || return 77
TEMP_JS="$(make_temp "$PROJECT_ROOT/.pages-live-js.XXXXXX")" || return 78
TEMP_CSS="$(make_temp "$PROJECT_ROOT/.pages-live-css.XXXXXX")" || return 79
TEMP_ASSETS="$(make_temp "$PROJECT_ROOT/.pages-live-assets.XXXXXX")" || return 80

printf '\n[VERIFY 1/3] Checking published HTML...\n'

HTML_STATUS=""

for attempt in $(seq 1 12); do
    HTML_RESPONSE="$(curl \
        --silent \
        --show-error \
        --location \
        --max-time 45 \
        --output "$TEMP_HTML" \
        --write-out '%{http_code}' \
        "${PAGES_URL}?deployment_check=$(date +%s)")"

    CURL_STATUS=$?

    if [[ "$CURL_STATUS" -eq 0 && "$HTML_RESPONSE" == "200" ]]; then
        HTML_STATUS="$HTML_RESPONSE"
        break
    fi

    printf '[WAIT] Public HTML not ready (%s/12); HTTP=%s curl=%s\n' \
        "$attempt" "$HTML_RESPONSE" "$CURL_STATUS"
    sleep 5
done

if [[ "$HTML_STATUS" != "200" ]]; then
    fail "Public HTML did not return HTTP 200." 81
    return 81
fi

printf '[OK] Public HTML returned HTTP 200.\n'

# ------------------------------------------------------------------------------
# 24. Extract public JavaScript and CSS URLs from the deployed HTML.
# ------------------------------------------------------------------------------

if ! python3 - "$TEMP_HTML" "$TEMP_ASSETS" <<'PYTHON'
from html.parser import HTMLParser
from pathlib import Path
import sys

class Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.styles = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)

        if tag.lower() == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])

        if tag.lower() == "link":
            rel = attrs.get("rel", "").lower().split()
            href = attrs.get("href")
            if href and "stylesheet" in rel:
                self.styles.append(href)

html = Path(sys.argv[1]).read_text(encoding="utf-8")
parser = Parser()
parser.feed(html)
parser.close()

if not parser.scripts:
    raise SystemExit("ERROR: Public HTML contains no JavaScript entry")

if not parser.styles:
    raise SystemExit("ERROR: Public HTML contains no stylesheet")

prefix = "/agent-topology-auditor/assets/"

for url in parser.scripts:
    if not url.startswith(prefix):
        raise SystemExit(f"ERROR: Unexpected public JS URL: {url}")
    print("JS\t" + url)

for url in parser.styles:
    if not url.startswith(prefix):
        raise SystemExit(f"ERROR: Unexpected public CSS URL: {url}")
    print("CSS\t" + url)

Path(sys.argv[2]).write_text(
    "\n".join(
        ["JS\t" + url for url in parser.scripts]
        + ["CSS\t" + url for url in parser.styles]
    ) + "\n",
    encoding="utf-8",
)
PYTHON
then
    fail "Could not validate deployed HTML asset references." 82
    return 82
fi

# ------------------------------------------------------------------------------
# 25. Verify every deployed JavaScript and CSS asset.
# ------------------------------------------------------------------------------

printf '\n[VERIFY 2/3] Checking public JavaScript and CSS assets...\n'

while IFS="$(printf '\t')" read -r asset_type asset_url; do
    case "$asset_type" in
        JS)
            asset_output="$TEMP_JS"
            ;;
        CSS)
            asset_output="$TEMP_CSS"
            ;;
        *)
            fail "Unexpected asset type in deployed HTML: $asset_type" 83
            return 83
            ;;
    esac

    asset_response="$(curl \
        --silent \
        --show-error \
        --location \
        --max-time 45 \
        --output "$asset_output" \
        --write-out '%{http_code}\t%{content_type}' \
        "https://swipswaps.github.io${asset_url}")"

    CURL_STATUS=$?

    if [[ "$CURL_STATUS" -ne 0 ]]; then
        fail "Could not retrieve deployed asset: $asset_url" 84
        return 84
    fi

    asset_http="${asset_response%%$'\t'*}"
    asset_mime="${asset_response#*$'\t'}"

    if [[ "$asset_http" != "200" ]]; then
        fail "Asset returned HTTP $asset_http: $asset_url" 85
        return 85
    fi

    if [[ ! -s "$asset_output" ]]; then
        fail "Deployed asset is empty: $asset_url" 86
        return 86
    fi

    case "$asset_type" in
        JS)
            case "$asset_mime" in
                *javascript* | *ecmascript*)
                    ;;
                *)
                    fail "Unexpected JavaScript MIME type: $asset_mime" 87
                    return 87
                    ;;
            esac
            ;;
        CSS)
            case "$asset_mime" in
                *text/css*)
                    ;;
                *)
                    fail "Unexpected CSS MIME type: $asset_mime" 88
                    return 88
                    ;;
            esac
            ;;
    esac

    printf '[OK] %s HTTP %s; MIME %s; %s\n' \
        "$asset_type" "$asset_http" "$asset_mime" "$asset_url"

done < "$TEMP_ASSETS"

# ------------------------------------------------------------------------------
# 26. Final report.
# ------------------------------------------------------------------------------

printf '\n============================================================\n'
printf '[SUCCESS] Build and deployment verification completed.\n'
printf '============================================================\n'
printf '[REPOSITORY] https://github.com/%s\n' "$REPOSITORY"
printf '[PAGES] %s\n' "$PAGES_URL"
printf '[COMMIT] %s\n' "$COMMIT_SHA"
printf '[WORKFLOW] https://github.com/%s/actions/runs/%s\n' "$REPOSITORY" "$RUN_ID"
printf '[VALIDATOR] %s\n' "$VALIDATOR_REL"
printf '[DOCUMENTATION] %s\n' "$README_REL"
printf '[BACKUPS] %s\n' "$BACKUP_DIR"

printf '\n[IMPORTANT LIMITATION]\n'
printf 'HTTP checks do not prove React, Three.js, D3, WebGL, or backend runtime success.\n'
printf 'A browser Developer Tools Console/Network test is still required.\n'

return 0
