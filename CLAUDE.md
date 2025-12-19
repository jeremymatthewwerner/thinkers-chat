# Dining Philosophers

Real-time multi-party chat with AI-simulated historical/contemporary thinkers.

## IMPORTANT Rules

- ALWAYS write tests alongside code (unit, integration, E2E)
- NEVER commit code without tests - minimum 80% coverage
- Commit and push frequently at logical checkpoints
- See REQUIREMENTS.md for full product specification
- **ALWAYS check things yourself before asking the user** - Use available tools (CLI, API calls, logs, code inspection) to verify state, configuration, or behavior. Only ask the user to check something if you've confirmed there's no way for you to check it directly.
- **ALWAYS check CI results after every push** - Use `gh run list` and `gh run view <id> --log-failed` to verify CI passes. If CI fails, debug and fix immediately. Do not consider a task complete until CI is green. Keep iterating until all checks pass.
- **When resuming work or assessing project state, ALWAYS check CI first** - Run `gh run list` before anything else. There may be failed runs from a previous session that need fixing. Don't assume local state is the full picture.
- **ALWAYS check open issues at session start** - Run `gh issue list` and work from highest priority (P0 → P1 → P2). Critical bugs must be addressed before new features.

## Development Workflow (MANDATORY)

At every meaningful milestone (new feature, API changes, UI flow completion):

1. **Run all unit tests** - `./scripts/test-all.sh` or run backend/frontend tests separately
2. **Run E2E tests** - `cd frontend && npx playwright test` (with backend running)
3. **Local user testing** - Have user manually test the feature in browser
4. **Fix any issues** - Repeat steps 1-3 until passing
5. **Commit and push** - Only after E2E and manual testing pass

**Why this matters**: Unit tests with mocked APIs won't catch schema mismatches between frontend and backend. E2E tests exercise the real API and catch integration bugs before they reach the user.

**E2E test requirements**:
- Every user-facing flow must have E2E coverage
- Test the happy path AND error cases
- Use real backend (not mocked) to validate actual API contracts

**When E2E tests hang or timeout (CRITICAL)**:
- **DO NOT assume it's a test or framework issue** - E2E tests exercise real code paths
- **ASSUME a real regression** - Something in recent changes broke the functionality
- **Investigate recent commits** - Look at what changed since tests last passed
- **Check the feature being tested** - If a test for "thinker suggestions" hangs, the thinker suggestion code likely has a bug
- **Avoid piling on fixes** - Don't keep adjusting test timeouts or adding workarounds; find and fix the root cause
- **The Claude API is core to this app** - We can't mock it away; if API calls hang, there's a real integration issue

## Tech Stack

- **Frontend**: Next.js (TypeScript strict mode)
- **Backend**: Python / FastAPI
- **Database**: PostgreSQL
- **LLM**: Claude API
- **Real-time**: WebSockets
- **Deployment**: Railway

## Commands

```bash
# Backend
cd backend
uv run pytest                    # run tests
uv run pytest --cov=app          # run tests with coverage
uv run ruff check .              # lint
uv run ruff format .             # format
uv run mypy .                    # type check
uv run uvicorn app.main:app --reload  # dev server

# Frontend
cd frontend
npm test                         # jest tests
npm run lint                     # eslint
npm run typecheck                # tsc
npm run dev                      # dev server
npx playwright test              # e2e tests

# Full test suite
./scripts/test-all.sh
```

## Testing

- **Backend**: pytest + pytest-asyncio + pytest-cov
- **Frontend**: Jest + React Testing Library
- **E2E**: Playwright
- Coverage minimum: 80%

### Test Rigor Protocol (MANDATORY)

**Before implementing any non-trivial feature or change:**
1. **Think deeply about test cases** - Consider what new unit, integration, and E2E tests are needed
2. **Document in TEST_PLAN.md** - Update the test plan document with new test cases before writing code
3. **Consider edge cases** - What could go wrong? What are the boundary conditions?

**After implementing:**
1. **Write tests for all new code** - Don't just test happy paths
2. **Update existing tests** - If behavior changed, tests should change too
3. **Run full test suite** - Verify nothing regressed

**Test plan document (TEST_PLAN.md) should include:**
- Features organized in outline form (features → sub-features)
- For each feature:
  - Setup requirements
  - Happy path test cases
  - Edge cases and error conditions
  - Cleanup steps if needed
- Likely tricky areas that need extra attention

This ensures comprehensive test coverage and prevents regressions.

## Code Style

- **Python**: ruff (format + lint + isort), mypy strict
- **TypeScript**: ESLint + Prettier, strict mode
- Run formatters before committing

## Git Workflow

**Claude Code sessions use feature branches:**
1. Create branch: `claude/<description>-<session-id>` (branch name is auto-assigned)
2. Commit changes with issue references (`Fixes #N` or `Relates to #N`)
3. Push to feature branch and create PR
4. CI runs on PR (including E2E) - must pass before merge
5. Merge PR (squash) - triggers deploy CI on main (E2E skipped, trusts PR)
6. Issues auto-close when PR merges

**IMPORTANT: Work one branch at a time**
- Do NOT work multiple feature branches in parallel
- Each branch passes E2E independently, but parallel branches could conflict on main
- Merge current branch before starting new work
- Feature branches can collect multiple logical commits into one merge

**Best practices:**
- Commit frequently with clear messages
- One logical change per commit
- Always reference GitHub issues in commits

## Task & Bug Tracking with GitHub Issues (MANDATORY)

All bugs AND tasks must be tracked via GitHub Issues for audit history and traceability.

### When to Create Issues

Create a GitHub issue for:
1. **Every bug found** - Whether discovered by Claude, CI/CD, or user-reported
2. **Every failing test** - If tests fail in CI, file an issue before fixing
3. **Every feature request** - Track requested features as issues
4. **Every task/todo** - Before starting work on non-trivial tasks, create an issue
5. **Multi-step work** - Break larger work into multiple linked issues

### Issue Workflow

1. **File the issue first** - Before starting work, create a GitHub issue with type prefix and priority label:
   ```bash
   # For bugs
   gh issue create --title "Bug: <brief description>" --body "<detailed description>" --label "P1,bug"

   # For features
   gh issue create --title "Feature: <brief description>" --body "<detailed description>" --label "P1,enhancement"

   # For tasks
   gh issue create --title "Task: <brief description>" --body "<detailed description>" --label "P2,task"
   ```

2. **Mark issue as in-progress** - Add the `claude-working` label when starting work:
   ```bash
   gh issue edit <issue-number> --add-label "claude-working"
   ```

3. **Reference issues in commits** - When committing, reference the issue:
   ```bash
   git commit -m "Fix <description>

   Fixes #<issue-number>"
   ```

   Or for partial progress:
   ```bash
   git commit -m "Progress on <description>

   Relates to #<issue-number>"
   ```

4. **Verify the fix** - Run tests and CI to confirm the fix works

5. **Close or reopen** - If CI passes, the issue auto-closes (and `claude-working` label is removed). If the fix fails, reopen:
   ```bash
   gh issue reopen <issue-number> --comment "Fix failed: <reason>"
   ```

### Issue Priority (MANDATORY)

**Always assign a priority label when creating issues:**
- **P0** - Blocks most or all functionality from working (critical bugs, system down)
- **P1** - Blocks some functionality from working correctly, OR new functionality requests
- **P2** - Optimizations, cleanup, refactoring, or minor improvements
- **P3** - Unprioritized (user-reported issues that need triage)

Use labels for priority (not title prefix). Example: `--label "P1,bug"`

### Working from Issues

**At the start of each session:**
1. Check for open issues: `gh issue list --repo jeremymatthewwerner/thinkers-chat`
2. Work from highest to lowest priority (P0 → P1 → P2)
3. If no open issues, ask the user what to work on

**P3 Triage workflow:**
- Periodically check for P3 (unprioritized) issues
- Review each P3 issue and assign appropriate priority (P0/P1/P2)
- Comment on the issue explaining the priority decision
- Update the issue title with the new priority

**This ensures critical bugs are always addressed first.**

### Issue Labels

Use labels to categorize issues:
- `bug` - Something isn't working
- `feature` - New feature request
- `task` - General task/work item
- `ci` - CI/CD related
- `claude-working` - Claude is actively working on this issue
- `in-review` - PR created, awaiting merge and deploy (prevents re-pickup)
- `needs-human-help` - Work failed, requires human intervention
- `epic` - Parent issue broken down into sub-tasks
- `claude-triaging` - Issue is being triaged by Claude
- `duplicate` - Issue is a duplicate of another

### Issue Templates

**Bug Report:** (title: `Bug: <description>`, labels: `P0/P1/P2, bug`)
```markdown
## Description
<What's broken?>

## Steps to Reproduce
1. <step 1>
2. <step 2>

## Expected Behavior
<What should happen?>

## Actual Behavior
<What actually happens?>

## Environment
- Browser/OS: <details>
- Relevant logs: <paste or link>
```

**Feature Request:** (title: `Feature: <description>`, labels: `P1/P2, enhancement`)
```markdown
## Description
<What feature is needed?>

## Use Case
<Why is this needed? What problem does it solve?>

## Proposed Solution
<How might this be implemented?>
```

**Task:** (title: `Task: <description>`, labels: `P1/P2, task`)
```markdown
## Description
<What needs to be done?>

## Acceptance Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>

## Related Issues
- #<related-issue-number>
```

## GitHub CLI Access (Claude Code)

The `gh` CLI is available and authenticated in Claude Code for managing GitHub operations. This works even though the git remote uses a local proxy.

### Setup (First Session Only)

If gh is not authenticated:
```bash
# Interactive web authentication
gh auth login --web --git-protocol https
# Follow the device code flow in browser
```

### Using gh with This Repo

Because the git remote points to a local proxy, always specify the repo explicitly:
```bash
# Check CI status
gh run list --repo jeremymatthewwerner/thinkers-chat --limit 5

# View failed CI logs
gh run view <run-id> --repo jeremymatthewwerner/thinkers-chat --log-failed

# Create issues
gh issue create --repo jeremymatthewwerner/thinkers-chat --title "Bug: ..." --body "..."

# List issues
gh issue list --repo jeremymatthewwerner/thinkers-chat

# Create PR
gh pr create --repo jeremymatthewwerner/thinkers-chat --title "..." --body "..."

# Merge PR after CI passes
gh pr merge <number> --repo jeremymatthewwerner/thinkers-chat --squash --delete-branch
```

### CI Pipeline

- **PR triggers**: Backend tests, Frontend tests, E2E tests
- **Main branch triggers**: Backend/Frontend tests + Docker build + Railway deploy + Smoke tests (E2E skipped - already passed on PR)
- Feature branch pushes don't trigger CI - must create a PR
- Always verify gh works: `gh auth status`

## Claude Automation (GitHub Actions)

Background automation handles issue triage and work without manual intervention. This section provides **complete, battle-tested instructions** for setting up Claude automation on any GitHub repository.

### Complete Automation Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLAUDE AUTOMATION LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. USER REPORTS BUG ──► Issue created with P3 label                       │
│           │                                                                 │
│           ▼                                                                 │
│  2. TRIAGE WORKFLOW ──► Analyzes issue, assigns P0/P1/P2, adds type label  │
│           │                                                                 │
│           ▼                                                                 │
│  3. WORK WORKFLOW ──► Picks up issue, implements fix, creates PR           │
│           │                                                                 │
│           ▼                                                                 │
│  4. CI/CD RUNS ──► Tests, linting, type checking                           │
│           │                                                                 │
│      ┌────┴────┐                                                            │
│      │         │                                                            │
│   PASSES    FAILS ──► CI/CD Fix workflow retries up to 15 times            │
│      │         │                                                            │
│      │     ┌───┴───┐                                                        │
│      │     │       │                                                        │
│      │  FIXED   ESCALATE ──► needs-human-help label, @mention owner        │
│      │     │                                                                │
│      ▼     ▼                                                                │
│  5. PR MERGES (auto-merge when CI passes)                                  │
│           │                                                                 │
│           ▼                                                                 │
│  6. DEPLOY TO PRODUCTION                                                   │
│           │                                                                 │
│           ▼                                                                 │
│  7. SMOKE TESTS PASS ──► Issue auto-closed ONLY after deploy succeeds     │
│           │                                                                 │
│      ┌────┴────┐                                                            │
│      │         │                                                            │
│   WORKS    BROKEN ──► User reopens issue ──► Workflow retries with         │
│      │                 different approach (knows previous fix failed)       │
│      ▼                                                                      │
│  8. DONE! ──► Work workflow self-chains to next issue                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Automated Workflows Overview

| Workflow | File | Triggers | Purpose |
|----------|------|----------|---------|
| **Triage** | `claude-triage.yml` | P3 label added, issue opened | Assign priority and type labels |
| **Work** | `claude-work.yml` | P0/P1/P2 label, reopened, assigned, scheduled | Implement fixes, create PRs |
| **CI/CD Fix** | `claude-cicd-fix.yml` | CI fails on claude[bot] PR | Auto-fix failing CI |
| **Breakdown** | `claude-breakdown.yml` | Issue too complex (50+ turns) | Split into sub-tasks |

---

## Setting Up Claude Automation for New Projects (Complete Guide)

### Step 1: Create Required Labels

```bash
# Priority labels
gh label create "P0" --color "FF0000" --description "Critical: Blocks most functionality"
gh label create "P1" --color "FF6600" --description "High: Blocks some functionality"
gh label create "P2" --color "FBCA04" --description "Medium: Optimizations, cleanup"
gh label create "P3" --color "EEEEEE" --description "Needs triage"

# Status labels
gh label create "claude-working" --color "7057ff" --description "Claude is actively working"
gh label create "claude-triaging" --color "7057ff" --description "Claude is triaging this issue"
gh label create "in-review" --color "0E8A16" --description "PR created, awaiting merge/deploy"
gh label create "needs-human-help" --color "D93F0B" --description "Requires human intervention"
gh label create "epic" --color "3E4B9E" --description "Parent issue with sub-tasks"
gh label create "duplicate" --color "CFD3D7" --description "Duplicate of another issue"

# Type labels
gh label create "bug" --color "D73A4A" --description "Something isn't working"
gh label create "enhancement" --color "A2EEEF" --description "New feature or request"
gh label create "task" --color "F9D0C4" --description "General task or work item"
```

### Step 2: Add Repository Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Required | Description |
|--------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Claude API key (starts with `sk-ant-`) |

### Step 3: Create the Work Workflow

Create `.github/workflows/claude-work.yml`:

```yaml
name: Claude Automated Work

on:
  # Trigger when issues get priority labels, assigned to claude[bot], or reopened
  issues:
    types: [labeled, assigned, reopened]

  # Self-chain via repository_dispatch
  repository_dispatch:
    types: [claude-work-continue]

  # Fallback: catch edge cases
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

  # Manual trigger
  workflow_dispatch:
    inputs:
      issue_number:
        description: 'Specific issue number to work on (optional)'
        required: false
        type: number

# Only one work job at a time - queue others
concurrency:
  group: claude-work
  cancel-in-progress: false

jobs:
  # Gate job: check if we should run
  should-run:
    if: >
      github.event_name != 'issues' ||
      github.event.action == 'assigned' ||
      github.event.action == 'reopened' ||
      github.event.label.name == 'P0' ||
      github.event.label.name == 'P1' ||
      github.event.label.name == 'P2'
    runs-on: ubuntu-latest
    outputs:
      should_run: ${{ steps.check.outputs.should_run }}
      assigned_issue: ${{ steps.check.outputs.assigned_issue }}
    steps:
      - name: Check trigger conditions
        id: check
        run: |
          # Always run for manual triggers, schedule, and repository_dispatch
          if [ "${{ github.event_name }}" = "workflow_dispatch" ] || \
             [ "${{ github.event_name }}" = "schedule" ] || \
             [ "${{ github.event_name }}" = "repository_dispatch" ]; then
            echo "should_run=true" >> $GITHUB_OUTPUT
            echo "assigned_issue=" >> $GITHUB_OUTPUT
            exit 0
          fi

          # For issue events
          if [ "${{ github.event_name }}" = "issues" ]; then
            ACTION="${{ github.event.action }}"

            # Assignment to claude[bot] - work on THIS specific issue
            if [ "$ACTION" = "assigned" ]; then
              ASSIGNEE="${{ github.event.assignee.login }}"
              if [ "$ASSIGNEE" = "claude[bot]" ]; then
                echo "should_run=true" >> $GITHUB_OUTPUT
                echo "assigned_issue=${{ github.event.issue.number }}" >> $GITHUB_OUTPUT
                exit 0
              else
                echo "should_run=false" >> $GITHUB_OUTPUT
                exit 0
              fi
            fi

            # Reopened issue - work on THIS specific issue (previous fix failed)
            if [ "$ACTION" = "reopened" ]; then
              echo "should_run=true" >> $GITHUB_OUTPUT
              echo "assigned_issue=${{ github.event.issue.number }}" >> $GITHUB_OUTPUT
              exit 0
            fi

            # Priority label - find highest priority issue
            LABEL="${{ github.event.label.name }}"
            if [ "$LABEL" = "P0" ] || [ "$LABEL" = "P1" ] || [ "$LABEL" = "P2" ]; then
              echo "should_run=true" >> $GITHUB_OUTPUT
              echo "assigned_issue=" >> $GITHUB_OUTPUT
            else
              echo "should_run=false" >> $GITHUB_OUTPUT
            fi
            exit 0
          fi

          echo "should_run=false" >> $GITHUB_OUTPUT

  find-work:
    needs: should-run
    if: needs.should-run.outputs.should_run == 'true'
    runs-on: ubuntu-latest
    outputs:
      issue_number: ${{ steps.find.outputs.issue_number }}
      issue_title: ${{ steps.find.outputs.issue_title }}
      has_more_work: ${{ steps.find.outputs.has_more_work }}
    permissions:
      issues: read

    steps:
      - name: Find highest priority issue
        id: find
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          # If assigned or reopened, work on THAT specific issue
          ASSIGNED_ISSUE="${{ needs.should-run.outputs.assigned_issue }}"
          if [ -n "$ASSIGNED_ISSUE" ]; then
            echo "issue_number=$ASSIGNED_ISSUE" >> $GITHUB_OUTPUT
            TITLE=$(gh issue view $ASSIGNED_ISSUE --repo ${{ github.repository }} --json title -q .title)
            echo "issue_title=$TITLE" >> $GITHUB_OUTPUT
            echo "has_more_work=false" >> $GITHUB_OUTPUT
            exit 0
          fi

          # If specific issue provided via manual trigger
          if [ -n "${{ inputs.issue_number }}" ]; then
            echo "issue_number=${{ inputs.issue_number }}" >> $GITHUB_OUTPUT
            TITLE=$(gh issue view ${{ inputs.issue_number }} --repo ${{ github.repository }} --json title -q .title)
            echo "issue_title=$TITLE" >> $GITHUB_OUTPUT
            echo "has_more_work=false" >> $GITHUB_OUTPUT
            exit 0
          fi

          # Find issues by priority, excluding blocked ones
          FOUND_COUNT=0
          FOUND_NUMBER=""
          FOUND_TITLE=""

          for priority in P0 P1 P2; do
            ISSUES=$(gh issue list --repo ${{ github.repository }} \
              --label "$priority" \
              --state open \
              --json number,title,labels \
              --jq '[.[] | select(.labels | map(.name) |
                (index("claude-working") | not) and
                (index("needs-human-help") | not) and
                (index("epic") | not) and
                (index("in-review") | not))]')

            COUNT=$(echo "$ISSUES" | jq 'length')

            if [ "$COUNT" -gt 0 ]; then
              if [ -z "$FOUND_NUMBER" ]; then
                FOUND_NUMBER=$(echo "$ISSUES" | jq -r '.[0].number')
                FOUND_TITLE=$(echo "$ISSUES" | jq -r '.[0].title')
              fi
              FOUND_COUNT=$((FOUND_COUNT + COUNT))
            fi
          done

          if [ -n "$FOUND_NUMBER" ]; then
            echo "issue_number=$FOUND_NUMBER" >> $GITHUB_OUTPUT
            echo "issue_title=$FOUND_TITLE" >> $GITHUB_OUTPUT
            [ "$FOUND_COUNT" -gt 1 ] && echo "has_more_work=true" >> $GITHUB_OUTPUT || echo "has_more_work=false" >> $GITHUB_OUTPUT
          else
            echo "issue_number=" >> $GITHUB_OUTPUT
            echo "has_more_work=false" >> $GITHUB_OUTPUT
          fi

  work-on-issue:
    needs: find-work
    if: needs.find-work.outputs.issue_number != ''
    runs-on: ubuntu-latest
    outputs:
      has_more_work: ${{ needs.find-work.outputs.has_more_work }}
    permissions:
      contents: write
      issues: write
      pull-requests: write
      id-token: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Mark issue as in-progress
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          # Remove in-review label if present (for reopened issues)
          gh issue edit ${{ needs.find-work.outputs.issue_number }} \
            --repo ${{ github.repository }} \
            --remove-label "in-review" || true
          gh issue edit ${{ needs.find-work.outputs.issue_number }} \
            --repo ${{ github.repository }} \
            --add-label "claude-working"

      - name: Work on issue
        id: claude
        uses: anthropics/claude-code-action@v1
        env:
          GH_TOKEN: ${{ github.token }}  # CRITICAL: Required for gh CLI to create PRs
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ github.token }}  # CRITICAL: Required for action's GitHub operations
          track_progress: ${{ github.event_name == 'issues' }}
          allowed_bots: '*'
          prompt: |
            You are working on issue #${{ needs.find-work.outputs.issue_number }}: ${{ needs.find-work.outputs.issue_title }}

            ## ⚠️ REOPENED ISSUE CHECK
            ${{ github.event.action == 'reopened' && '**THIS IS A REOPENED ISSUE.** The previous fix did NOT work in production. You MUST:
            1. Review the issue comments to understand what was tried before
            2. Check the git history for the previous fix attempt
            3. Understand WHY the previous fix failed in production
            4. Take a DIFFERENT approach - do not repeat the same fix
            5. Be more thorough with testing and verification' || 'This is a new issue (not reopened).' }}

            ## Instructions
            1. Read CLAUDE.md for project context and coding standards
            2. Read the full issue details with: gh issue view ${{ needs.find-work.outputs.issue_number }}
            3. Review issue comments for context on previous attempts
            4. Understand the codebase structure
            5. Implement the required changes
            6. Run tests to verify your changes work
            7. Create a PR with your changes

            ## Development Workflow
            - Create a branch: git checkout -b claude/issue-${{ needs.find-work.outputs.issue_number }}-${{ github.run_id }}
            - Make changes and commit with message referencing the issue
            - Push the branch
            - Create a PR: gh pr create --title "..." --body "Relates to #${{ needs.find-work.outputs.issue_number }}"
            - Enable auto-merge: gh pr merge --auto --squash

            ## IMPORTANT: Use "Relates to #N", NOT "Fixes #N"
            Issues are closed by the CI pipeline AFTER successful deployment, not on PR merge.
            This ensures users don't see "fixed" issues that haven't deployed yet.

          claude_args: |
            --max-turns 50
            --dangerously-skip-permissions
            --allowedTools "Edit,MultiEdit,Glob,Grep,LS,Read,Write,Bash(git:*),Bash(gh issue:*),Bash(gh pr:*),Bash(gh api:*),Bash(cd backend && uv run:*),Bash(cd frontend && npm:*)"

      - name: Mark work complete on success
        if: success()
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh issue edit ${{ needs.find-work.outputs.issue_number }} \
            --repo ${{ github.repository }} \
            --remove-label "claude-working" \
            --add-label "in-review" || true

      - name: Handle failure
        if: failure()
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh issue edit ${{ needs.find-work.outputs.issue_number }} \
            --repo ${{ github.repository }} \
            --remove-label "claude-working" \
            --add-label "needs-human-help" || true

  # Self-chain to process remaining issues
  continue-work:
    needs: [find-work, work-on-issue]
    if: always() && needs.find-work.outputs.has_more_work == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Trigger next work cycle
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh api repos/${{ github.repository }}/dispatches \
            -f event_type=claude-work-continue
```

### Step 4: Create the Triage Workflow

Create `.github/workflows/claude-triage.yml`:

```yaml
name: Claude Issue Triage

on:
  issues:
    types: [opened, labeled]

concurrency:
  group: claude-triage-${{ github.event.issue.number }}
  cancel-in-progress: true

jobs:
  triage:
    if: >
      (github.event.action == 'opened') ||
      (github.event.action == 'labeled' && github.event.label.name == 'P3')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write

    steps:
      - uses: actions/checkout@v4

      - name: Mark as triaging
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh issue edit ${{ github.event.issue.number }} \
            --repo ${{ github.repository }} \
            --add-label "claude-triaging"

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            Triage issue #${{ github.event.issue.number }}: ${{ github.event.issue.title }}

            Body: ${{ github.event.issue.body }}

            ## Priority Definitions
            - P0: Blocks most/all functionality (critical bugs, system down)
            - P1: Blocks some functionality OR new feature requests
            - P2: Optimizations, cleanup, minor improvements

            ## Your Task
            1. Analyze the issue content
            2. Assign priority (P0, P1, or P2)
            3. Assign type (bug, enhancement, or task)
            4. Check for duplicates
            5. Comment with your reasoning

            Commands:
            - gh issue edit ${{ github.event.issue.number }} --remove-label "P3" --add-label "P1,bug"
            - gh issue comment ${{ github.event.issue.number }} --body "..."

          claude_args: |
            --dangerously-skip-permissions
            --allowedTools "Bash(gh issue:*),Bash(gh search:*)"

      - name: Remove triaging label
        if: always()
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh issue edit ${{ github.event.issue.number }} \
            --repo ${{ github.repository }} \
            --remove-label "claude-triaging" || true
```

### Step 5: Configure CI to Close Issues After Deploy

Add this job to your CI workflow (runs AFTER deployment):

```yaml
  close-related-issues:
    needs: [deploy, smoke-test]  # Only after successful deploy
    if: success() && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: read
    steps:
      - name: Close issues mentioned in merged PRs
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          # Get recent merged PRs
          PRS=$(gh pr list --repo ${{ github.repository }} --state merged --limit 10 --json number,body)

          # Extract issue numbers from "Relates to #N" patterns
          echo "$PRS" | jq -r '.[].body' | grep -oP 'Relates to #\K\d+' | sort -u | while read ISSUE; do
            echo "Closing issue #$ISSUE after successful deploy"
            gh issue close "$ISSUE" --repo ${{ github.repository }} \
              --comment "✅ Fix deployed to production and verified."
            gh issue edit "$ISSUE" --repo ${{ github.repository }} \
              --remove-label "in-review" || true
          done
```

---

## Critical Configuration Details (Gotchas)

### 1. GH_TOKEN is REQUIRED for PR Creation

The `gh` CLI needs authentication to create PRs. You MUST add BOTH:

```yaml
- name: Work on issue
  uses: anthropics/claude-code-action@v1
  env:
    GH_TOKEN: ${{ github.token }}  # For gh CLI
  with:
    github_token: ${{ github.token }}  # For action internals
```

**Without this, Claude will complete work but can't create PRs!**

### 2. Use Explicit gh Command Patterns in allowedTools

The action may not recognize `Bash(gh:*)`. Use explicit patterns:

```yaml
# ❌ WRONG - may not work
--allowedTools "Bash(gh:*)"

# ✅ CORRECT - explicit patterns
--allowedTools "Bash(gh issue:*),Bash(gh pr:*),Bash(gh api:*)"
```

### 3. Use "Relates to #N", NOT "Fixes #N"

GitHub auto-closes issues when PRs with "Fixes #N" merge. But the fix isn't deployed yet!

```yaml
# ❌ WRONG - closes issue on PR merge (before deploy)
git commit -m "Fix bug\n\nFixes #123"

# ✅ CORRECT - CI closes issue after deploy
git commit -m "Fix bug\n\nRelates to #123"
```

### 4. Handle Reopened Issues (Previous Fix Failed)

When users reopen issues, the previous "fix" didn't actually work:

```yaml
on:
  issues:
    types: [labeled, assigned, reopened]  # Include 'reopened'!
```

And in the prompt:
```yaml
${{ github.event.action == 'reopened' && '**THIS IS A REOPENED ISSUE.**
The previous fix did NOT work. Take a DIFFERENT approach!' || '' }}
```

### 5. Exclude Blocking Labels in Issue Search

Prevent infinite loops and duplicate work:

```bash
gh issue list --label "P0" --json labels --jq '[.[] | select(.labels | map(.name) |
  (index("claude-working") | not) and
  (index("needs-human-help") | not) and
  (index("epic") | not) and
  (index("in-review") | not))]'
```

### 6. Branch Protection (Recommended)

Without branch protection, auto-merge happens instantly (before CI runs!):

```bash
# Add via GitHub UI: Settings → Branches → Add rule
# Or via API:
gh api repos/OWNER/REPO/branches/main/protection -X PUT \
  -f required_status_checks='{"strict":true,"contexts":["test","lint"]}' \
  -f enforce_admins=false \
  -f required_pull_request_reviews=null \
  -f restrictions=null
```

### 7. Action Defaults to Manual PR Links (CRITICAL)

**The action's built-in instructions tell Claude to provide manual PR creation links instead of using `gh pr create`!** This completely breaks automation.

You MUST add explicit override instructions at the TOP of your custom `prompt`:

```yaml
prompt: |
  ## ⚠️ CRITICAL: AUTOMATIC PR CREATION REQUIRED
  **THIS IS A FULLY AUTOMATED WORKFLOW.** You MUST create PRs automatically using `gh pr create`.
  **DO NOT** provide manual PR creation links. **DO NOT** ask the user to create a PR.
  After pushing your branch, you MUST run: `gh pr create --title "..." --body "..."`
  Then enable auto-merge: `gh pr merge --auto --squash`
  This overrides any default instructions about manual PR links.

  ## Your actual instructions here...
```

**Why this happens:** The action has built-in instructions that say:
> "Provide a URL to create a PR manually in this format: [Create a PR](https://github.com/...)"

Your custom `prompt` is added AFTER these built-in instructions, so Claude follows the built-in behavior unless you explicitly override it.

### 8. Workflow Permissions Must Allow PR Creation

GitHub Actions default workflow permissions may be set to `read` only, which prevents Claude from creating PRs:

```bash
# Check current permissions
gh api repos/OWNER/REPO/actions/permissions/workflow

# Enable PR creation (REQUIRED for automation)
gh api repos/OWNER/REPO/actions/permissions/workflow -X PUT \
  -f default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=true
```

Or via GitHub UI: **Settings → Actions → General → Workflow permissions** → Select "Read and write permissions" and enable "Allow GitHub Actions to create and approve pull requests"

### 9. track_progress Doesn't Support 'reopened' Events

The `claude-code-action` throws `Unsupported issue action: reopened` when `track_progress` is enabled for reopened issues:

```yaml
# ❌ WRONG - fails on reopened events
track_progress: ${{ github.event_name == 'issues' }}

# ✅ CORRECT - exclude reopened events
track_progress: ${{ github.event_name == 'issues' && github.event.action != 'reopened' }}
```

---

## Debugging Workflow Issues

### Check if gh CLI has auth
```bash
gh run view <run-id> --log 2>&1 | grep "ALLOWED_TOOLS"
```

### See what tools Claude received
```bash
gh run view <run-id> --log 2>&1 | grep -A30 "SDK options"
```

### Check for PR creation errors
```bash
gh run view <run-id> --log 2>&1 | grep -i "gh pr\|error\|denied"
```

### Enable full output for debugging
```yaml
- uses: anthropics/claude-code-action@v1
  with:
    show_full_output: true  # Shows full Claude conversation
```

---

## Manual Triggers

```bash
# Work on specific issue
gh workflow run claude-work.yml -f issue_number=123

# Trigger CI/CD fix
gh workflow run claude-cicd-fix.yml -f pr_number=42

# Re-run failed workflow
gh run rerun <run-id>
```

---

## Monitoring

```bash
# View automation runs
gh run list --workflow=claude-work.yml --limit 10

# Check in-progress work
gh issue list --label "claude-working"

# Check blocked issues
gh issue list --label "needs-human-help"

# View specific run logs
gh run view <run-id> --log
gh run view <run-id> --log-failed  # Only failures
```

## Architecture

- Thinker agents run as independent async tasks (concurrent responses)
- Conversation only progresses when user has chat window open
- Agents resume automatically when user returns to chat
