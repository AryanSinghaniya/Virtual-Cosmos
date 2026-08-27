# Contributing to Virtual Cosmos

This guide defines the engineering conventions, Git branching strategy, and code review standards used across the repository.

---

## 1. Git Branching Strategy (Trunk-Based with Feature Branches)

* **`main`**: Production-ready code. Protected branch. Only merged via approved Pull Requests that pass CI.
* **`develop`**: Staging / integration branch for active development.
* **Feature Branches**: `feat/<feature-name>` (e.g. `feat/pgvector-similarity-search`, `feat/webrtc-screenshare`)
* **Bug Fix Branches**: `fix/<bug-name>` (e.g. `fix/websocket-reconnect-loop`)
* **Chore/DevOps**: `chore/<task>` or `ci/<pipeline-update>`

---

## 2. Commit Message Conventions (Conventional Commits)

Format: `<type>(<scope>): <subject>`

Examples:
* `feat(backend): add pgvector cosine distance endpoint with HNSW index`
* `feat(frontend): migrate spatial canvas state to Zustand store`
* `fix(auth): resolve JWT token expiration refresh loop`
* `perf(spatial): optimize PostGIS proximity query with GIST bounding box`
* `ci(docker): configure multi-stage Python 3.12 Dockerfile`

---

## 3. Pull Request & Code Review Process

1. Create a descriptive branch from `develop` or `main`.
2. Ensure local verification passes:
   * Backend: `pytest`
   * Frontend: `npm run typecheck && npm run build`
3. Open a Pull Request using the PR template.
4. Ensure CI pipeline checks pass (Pytest, TypeScript, Docker build).
5. Address code review feedback with granular follow-up commits.
6. Squash & merge into target branch.
