# Thinkers Chat

Real-time multi-party chat with AI-simulated historical/contemporary thinkers.

## IMPORTANT Rules

- ALWAYS write tests alongside code (unit, integration, E2E)
- NEVER commit code without tests - minimum 80% coverage
- Commit and push frequently at logical checkpoints
- See REQUIREMENTS.md for full product specification
- **ALWAYS check things yourself before asking the user** - Use available tools (CLI, API calls, logs, code inspection) to verify state, configuration, or behavior. Only ask the user to check something if you've confirmed there's no way for you to check it directly.
- **ALWAYS check CI results after every push** - Use `gh run list` and `gh run view <id> --log-failed` to verify CI passes. If CI fails, debug and fix immediately. Do not consider a task complete until CI is green. Keep iterating until all checks pass.
- **When resuming work or assessing project state, ALWAYS check CI first** - Run `gh run list` before anything else. There may be failed runs from a previous session that need fixing. Don't assume local state is the full picture.

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

## Git

- Work directly on `main` branch - no feature branches needed for this project
- Commit frequently with clear messages
- One logical change per commit
- Push to main after tests pass locally

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

1. **File the issue first** - Before starting work, create a GitHub issue:
   ```bash
   # For bugs
   gh issue create --title "Bug: <brief description>" --body "<detailed description>"

   # For features/tasks
   gh issue create --title "Feature: <brief description>" --body "<detailed description>"

   # For tasks
   gh issue create --title "Task: <brief description>" --body "<detailed description>"
   ```

2. **Reference issues in commits** - When committing, reference the issue:
   ```bash
   git commit -m "Fix <description>

   Fixes #<issue-number>"
   ```

   Or for partial progress:
   ```bash
   git commit -m "Progress on <description>

   Relates to #<issue-number>"
   ```

3. **Verify the fix** - Run tests and CI to confirm the fix works

4. **Close or reopen** - If CI passes, the issue auto-closes. If the fix fails, reopen:
   ```bash
   gh issue reopen <issue-number> --comment "Fix failed: <reason>"
   ```

### Issue Labels

Use labels to categorize issues:
- `bug` - Something isn't working
- `feature` - New feature request
- `task` - General task/work item
- `ci` - CI/CD related
- `urgent` - High priority

### Issue Templates

**Bug Report:**
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

**Feature Request:**
```markdown
## Description
<What feature is needed?>

## Use Case
<Why is this needed? What problem does it solve?>

## Proposed Solution
<How might this be implemented?>
```

**Task:**
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
```

### Important Notes

- CI only runs on `main` branch or PRs targeting `main` (see `.github/workflows/ci.yml`)
- Feature branch pushes don't trigger CI - create a PR to run CI
- Always verify gh works: `gh auth status`

## Architecture

- Thinker agents run as independent async tasks (concurrent responses)
- Conversation only progresses when user has chat window open
- Agents resume automatically when user returns to chat
