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
