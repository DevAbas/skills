#!/usr/bin/env bash
# react-audit automated scanner
# Runs quick structural checks and outputs scan-results.json
# Falls back gracefully when tools are missing.

set -euo pipefail

PROJECT_ROOT="${1:-.}"
OUTPUT_FILE="${PROJECT_ROOT}/scan-results.json"

echo '{}' > "$OUTPUT_FILE"

# Helper: update JSON output (works without jq)
update_json() {
  local key="$1" value="$2"
  local tmp
  tmp=$(mktemp)
  if command -v jq &>/dev/null; then
    jq --arg k "$key" --argjson v "$value" '. + {($k): $v}' "$OUTPUT_FILE" > "$tmp"
  else
    # Fallback: simple append (not valid JSON merge, but Claude can parse)
    python3 -c "
import json, sys
with open('$OUTPUT_FILE') as f: d = json.load(f)
d['$key'] = json.loads('$value')
with open('$tmp', 'w') as f: json.dump(d, f, indent=2)
" 2>/dev/null || echo "{\"$key\": $value}" >> "$OUTPUT_FILE"
  fi
  mv "$tmp" "$OUTPUT_FILE"
}

# 1. Line count
echo "Counting lines..."
if command -v cloc &>/dev/null; then
  LOC=$(cloc "$PROJECT_ROOT/src" --json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps({k: v.get('code',0) for k,v in d.items() if k not in ['header','SUM']}))" 2>/dev/null || echo '{}')
  TOTAL=$(cloc "$PROJECT_ROOT/src" --json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('SUM',{}).get('code',0))" 2>/dev/null || echo '0')
else
  TOTAL=$(find "$PROJECT_ROOT/src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')
  LOC="{}"
fi
update_json "total_loc" "$TOTAL"
update_json "loc_by_language" "$LOC"

# 2. File count and largest files
echo "Finding largest files..."
LARGEST=$(find "$PROJECT_ROOT/src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -exec wc -l {} + 2>/dev/null | sort -rn | head -11 | tail -10 | awk '{print "{\"lines\": "$1", \"file\": \""$2"\"}"}' | paste -sd',' - | sed 's/^/[/;s/$/]/')
FILE_COUNT=$(find "$PROJECT_ROOT/src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) 2>/dev/null | wc -l | tr -d ' ')
update_json "file_count" "$FILE_COUNT"
update_json "largest_files" "${LARGEST:-[]}"

# 3. Pattern matching for anti-patterns
echo "Scanning for anti-patterns..."

# Directories containing code examples as strings (not executable code).
# Exclude these from pattern-matching to avoid false positives.
CONTENT_EXCLUDE="--exclude-dir=content"

# Swallowed errors
SWALLOWED=$(grep -rn $CONTENT_EXCLUDE 'catch' "$PROJECT_ROOT/src" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' 2>/dev/null | grep -v 'console\.\|throw\|logger\.\|report\.\|notify\.\|captureException\|captureMessage\|Sentry\.\|bugsnag\.\|Error(' | wc -l | tr -d ' ' || true)
update_json "swallowed_errors" "$SWALLOWED"

# dangerouslySetInnerHTML without sanitize
DANGEROUS=$(grep -rn $CONTENT_EXCLUDE 'dangerouslySetInnerHTML' "$PROJECT_ROOT/src" --include='*.tsx' --include='*.jsx' 2>/dev/null | wc -l | tr -d ' ' || true)
update_json "dangerous_inner_html" "$DANGEROUS"

# useEffect without cleanup
EFFECTS_TOTAL=$(grep -rn $CONTENT_EXCLUDE 'useEffect' "$PROJECT_ROOT/src" --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ' || true)
EFFECTS_WITH_CLEANUP=$(grep -rn $CONTENT_EXCLUDE 'return.*().*=>' "$PROJECT_ROOT/src" --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ' || true)
update_json "use_effect_total" "$EFFECTS_TOTAL"
update_json "use_effect_with_cleanup" "$EFFECTS_WITH_CLEANUP"

# Raw fetch without wrapper
RAW_FETCH=$(grep -rn $CONTENT_EXCLUDE 'fetch(' "$PROJECT_ROOT/src" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' 2>/dev/null | grep -v 'import\|require\|fetchData\|fetchApi\|useFetch\|createFetch\|apiClient\|httpClient' | wc -l | tr -d ' ' || true)
update_json "raw_fetch_calls" "$RAW_FETCH"

# eslint-disable for hooks
ESLINT_DISABLE_HOOKS=$(grep -rn $CONTENT_EXCLUDE 'eslint-disable.*exhaustive-deps\|eslint-disable.*rules-of-hooks' "$PROJECT_ROOT/src" --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ' || true)
update_json "eslint_disable_hooks" "$ESLINT_DISABLE_HOOKS"

# Nested ternaries in JSX
NESTED_TERNARY=$(grep -rn $CONTENT_EXCLUDE '?.*?.*:.*:' "$PROJECT_ROOT/src" --include='*.tsx' --include='*.jsx' 2>/dev/null | wc -l | tr -d ' ' || true)
update_json "nested_ternaries" "$NESTED_TERNARY"

# Files over 300 LoC (exclude content data files; they're authored data, not logic)
LARGE_FILES=$(find "$PROJECT_ROOT/src" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -not -path '*/content/*' -exec sh -c 'lines=$(wc -l < "$1"); [ "$lines" -gt 300 ] && echo "$1:$lines"' _ {} \; 2>/dev/null | wc -l | tr -d ' ')
update_json "files_over_300_loc" "$LARGE_FILES"

# Error boundaries
ERROR_BOUNDARIES=$(grep -rln $CONTENT_EXCLUDE 'componentDidCatch\|ErrorBoundary\|error\.tsx' "$PROJECT_ROOT/src" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' 2>/dev/null | wc -l | tr -d ' ' || true)
update_json "error_boundary_files" "$ERROR_BOUNDARIES"

# useState count
USE_STATE=$(grep -rn $CONTENT_EXCLUDE 'useState' "$PROJECT_ROOT/src" --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ' || true)
update_json "use_state_count" "$USE_STATE"

echo "Scan complete. Results at $OUTPUT_FILE"
cat "$OUTPUT_FILE"
