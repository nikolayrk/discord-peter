#!/usr/bin/env bash
set -euo pipefail

# Never execute code or use artifacts from the PR workflow.
[ "$RUN_HEAD_REPO" = "$GH_REPO" ] || exit 0

# Confirm the expected checks actually ran and succeeded.
jobs=$(GH_TOKEN="$READ_TOKEN" gh api --paginate "repos/$GH_REPO/actions/runs/$RUN_ID/jobs?per_page=100" --jq '.jobs[] | [.name, .conclusion] | @tsv')
for job in 'node' 'chart' 'chart-integration'; do
  printf '%s\n' "$jobs" | grep -Fx "$job"$'\t'success >/dev/null || {
    echo "Required job did not succeed: $job"
    exit 1
  }
done

# Resolve the PR using GitHub's API, not data supplied by the run.
prs=$(GH_TOKEN="$READ_TOKEN" gh api --paginate "repos/$GH_REPO/pulls?state=open&per_page=100" \
  --jq '.[] | select(.user.login == "dependabot[bot]") | [.number, .head.sha, .head.repo.full_name, .head.ref, .base.ref] | @tsv')
matches=$(printf '%s\n' "$prs" | awk -F '\t' -v sha="$RUN_HEAD_SHA" -v repo="$GH_REPO" -v branch="$RUN_HEAD_BRANCH" \
  '$2 == sha && $3 == repo && $4 == branch && $5 == "main" { print $1 }')
[ -n "$matches" ] || { echo "No matching open Dependabot PR"; exit 0; }
[ "$(printf '%s\n' "$matches" | wc -l)" -eq 1 ] || { echo "Ambiguous PR"; exit 1; }
pr="$matches"

# The approval is attached to the tested commit, and merge is guarded
# by the same SHA so an update cannot race the completed run.
gh api "repos/$GH_REPO/pulls/$pr/reviews" -f event=APPROVE -f commit_id="$RUN_HEAD_SHA" >/dev/null
gh pr merge "$pr" --repo "$GH_REPO" --auto --merge --match-head-commit "$RUN_HEAD_SHA"
