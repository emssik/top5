---
name: refactor-team
description: Orchestrate a coordinated team of AI agents for larger refactoring tasks in the top5 Electron project. Use when: performing multi-file refactoring, splitting large components or modules, restructuring architecture, extracting shared logic, or any code change that touches 3+ files and benefits from parallel work. Triggers: user says "refactoring team", "refactor with agents", "team refactor", "split this into smaller pieces", "restructure this module", "duży refactoring", "refaktor z zespołem", or when user explicitly asks for a team-based approach to code changes. Do NOT use for: single-file fixes, small edits, research-only tasks, or changes where the approach is already fully specified and trivial to implement.
---

# Refactor Team

Orchestrate a team of agents to execute larger refactoring tasks in the top5 project.

## Workflow

```
0. Branch   → create/confirm refactoring branch
1. Analyze  → understand scope and map impact
2. Clarify  → ask targeted questions (max 2-3)
3. Plan     → design approach with file-level detail
4. Team     → spawn optimal team based on scope
5. Execute  → coordinate parallel implementation
6. Review   → code quality check (KISS, DRY, conventions)
7. Verify   → build, test, final sign-off
```

## Phase 0: Branch

Before any work, ensure a dedicated refactoring branch exists:

1. Check current branch with `git branch --show-current`
2. **On `main`** → create and checkout a new branch: `git checkout -b refactor/<short-description>`
3. **Not on `main`** → ask the user whether to create a new branch or continue on the current one

This branch will be the base for all worktree agents. Worktrees branch off from HEAD, so they will inherit this refactoring branch.

## Phase 1: Analyze

1. Read `CLAUDE.md` and `docs/CODING_GUIDE.md` for project conventions
2. Read `references/project-context.md` for architecture and pitfalls
3. Use Explore agent to map the impact area:
   - Which files are affected?
   - What are the dependencies between them?
   - Are IPC boundaries crossed (main ↔ preload ↔ renderer)?
4. Estimate scope: **small** (1-3 files), **medium** (4-8 files), **large** (8+ files)

## Phase 2: Clarify

Ask the user targeted questions via AskUserQuestion:

- **Scope boundaries**: "Should I also refactor X which is tightly coupled?"
- **Breaking changes**: "This will change the IPC contract — OK?"
- **Priorities**: "Split by feature domain or by responsibility?"

Max 2-3 questions. Skip if the request is already clear.

## Phase 3: Plan

Use EnterPlanMode:

1. List every file to create, modify, or delete
2. Describe changes per file (1-2 sentences)
3. Identify dependency order — what must change first
4. Flag risks: stale closures, IPC changes, type changes
5. Define verification steps

Get user approval before proceeding.

## Phase 4: Team Setup

Read `references/team-patterns.md` and select the right composition based on scope.

**For small refactoring (1-3 files)**: Do NOT spawn a team — handle directly.

**For medium+ refactoring**: Create team with TeamCreate, spawn agents with Task tool.

### Agent Configuration

- Name agents descriptively: `explorer`, `impl-1`, `impl-2`, `reviewer`
- Each implementer gets `isolation: "worktree"` to avoid conflicts
- Set `mode: "bypassPermissions"` — this is a local-only, solo-dev project where speed matters

### Task Setup

Create tasks with TaskCreate following the plan. Set dependencies with `addBlockedBy`/`addBlocks`.

### Agent Prompts

Every agent prompt MUST include:
1. Specific task description with acceptance criteria
2. Files to read first (with reasons)
3. Files to modify (with expected changes)
4. Relevant pitfalls from `references/project-context.md`
5. Instructions to mark task completed and report back when done

See the prompt template in `references/team-patterns.md`.

## Phase 5: Execute

1. Assign tasks to agents via TaskUpdate
2. Monitor — agents report via SendMessage
3. Unblock or reassign if an agent gets stuck
4. When an implementer finishes, assign next available task

### Worktree Merge

After all tasks complete:
1. Review each worktree's diff
2. Apply changes sequentially to the main working directory
3. Resolve any conflicts between worktrees

## Phase 6: Review

After worktree changes are merged, spawn the **reviewer** agent (see `references/team-patterns.md` for role details and prompt).

The reviewer reads `docs/CODING_GUIDE.md` and the full diff, then checks:

1. **KISS** — are functions/components small and single-purpose? No unnecessary abstractions?
2. **DRY** — is there duplicated logic that should be in utils/hooks? Single source of truth kept?
3. **Conventions** — no `any`, no stale closures, IPC contract consistent, Tailwind for styling?
4. **Simplicity** — no over-engineering, no feature creep beyond what was requested?
5. **Readability** — clear names, minimal nesting, easy to follow?

The reviewer produces a list of issues (with file:line references). If issues found:
- Trivial fixes → reviewer fixes them directly
- Bigger issues → sends back to implementer with specific instructions

Iterate until the reviewer approves.

## Phase 7: Verify

After review passes:

```bash
npm run build        # MUST pass
npm run test:api     # if API changes
npm run test         # if shared logic changes
```

Then:
1. Final `git diff` review
2. Verify IPC contract consistency (main ↔ preload ↔ renderer types)
3. Report summary to user

Remind user to manually test: launchers, focus mode, compact mode, theme, quick add, and any features touched by the refactoring.

## Shutdown

1. Send `shutdown_request` to all teammates
2. Clean up with TeamDelete
3. Summarize: files changed, what was refactored, what to test
