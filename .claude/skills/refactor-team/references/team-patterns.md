# Team Patterns

Select team composition based on refactoring scope.

## Small Refactoring (1-3 files)

**Do NOT spawn a team.** Handle directly — overhead isn't worth it.

Use EnterPlanMode → implement → verify. One agent is enough.

## Medium Refactoring (4-8 files)

**Team: Lead + 2 Implementers + Reviewer**

```
TeamCreate: "refactor-{feature}"

Agents:
  impl-1: general-purpose, isolation: worktree
    → handles first batch of files
  impl-2: general-purpose, isolation: worktree
    → handles second batch of files
  reviewer: general-purpose
    → code quality gate (runs after impl agents finish)
```

Lead (you) coordinates. Reviewer runs after all implementation is merged.

**Task dependency example:**
```
Task 1: "Update shared types" (no deps) → impl-1
Task 2: "Refactor main process handlers" (blocked by 1) → impl-1
Task 3: "Refactor renderer components" (blocked by 1) → impl-2
Task 4: "Update preload bridge" (blocked by 2, 3) → impl-1
```

## Large Refactoring (8+ files)

**Team: Lead + Explorer + 2-3 Implementers + Reviewer**

```
TeamCreate: "refactor-{feature}"

Agents:
  explorer: Explore subagent (read-only)
    → deep codebase analysis, dependency mapping, find all usages
  impl-1: general-purpose, isolation: worktree
    → core changes (types, services, main process)
  impl-2: general-purpose, isolation: worktree
    → renderer/UI changes
  impl-3: general-purpose, isolation: worktree (optional)
    → tests, preload bridge, auxiliary files
  reviewer: general-purpose
    → code quality gate: KISS, DRY, conventions, readability
```

**Explorer runs first** to produce a detailed impact analysis. Other agents start after.
**Reviewer runs last** — after all changes are merged, reviews the full diff.

## Cross-Boundary Refactoring (IPC changes)

When refactoring crosses main ↔ preload ↔ renderer boundary:

**Strict ordering required:**
1. `src/shared/types.ts` — update types first
2. `src/main/service/*.ts` — update business logic
3. `src/main/store.ts` — update IPC handlers
4. `src/preload/index.ts` — update bridge
5. `src/renderer/**` — update UI consumers

Assign to a single implementer or use strict `addBlockedBy` chains. Cross-boundary changes done in parallel cause merge hell.

## Reviewer Role

The reviewer is the code quality gate. Spawned after all implementation is merged.

**Reviewer prompt template:**

```
## Task
Review all changes from the refactoring for code quality. Read docs/CODING_GUIDE.md first.

## What to Check

### KISS
- Functions/components small and single-purpose?
- No unnecessary abstractions or premature generalization?
- No over-engineering — does it solve exactly what was asked, nothing more?
- Three similar lines > premature abstraction

### DRY
- Duplicated logic that should be in utils/hooks?
- Single source of truth maintained (types in shared/types.ts)?
- Shared constants not copy-pasted?

### Conventions
- No `any` types
- No stale closure patterns (must use useProjects.getState())
- IPC contract consistent across main/preload/renderer
- Tailwind for styling, no inline styles
- Validate IPC payloads in main process

### Readability
- Clear, descriptive names
- Minimal nesting (early returns preferred)
- Easy to follow for a solo developer coming back after a break

## How to Review
1. Run `git diff` to see all changes
2. Read each changed file in full context (not just the diff)
3. Produce a list of issues as: `file:line — issue description`
4. Fix trivial issues (typos, naming, small extractions) directly
5. For bigger issues, report back with specific fix instructions

## When Done
If no issues: mark task completed, report "review passed" to lead.
If issues fixed: mark completed, report what you fixed.
If issues need implementer: report the list to lead.
```

## Agent Prompt Template

Use this structure for every implementer agent prompt:

```
## Task
{specific task description}

## Files to Read First
- {file1} — {why}
- {file2} — {why}

## Files to Modify
- {file1} — {what to change}
- {file2} — {what to change}

## Conventions
- TypeScript, no `any` types
- Tailwind for styling, small components
- Single source of truth for types: src/shared/types.ts
- IPC payloads validated in main process
- Always use `useProjects.getState()` not closure state

## Known Pitfalls
{relevant items from project-context.md}

## When Done
Mark your task as completed via TaskUpdate.
Report what you changed via SendMessage to team lead.
```
