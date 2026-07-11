# Fragility Score: Scoring Formula

## Per-Concept Score (0-10)

Each concept is scored 0-10 where 0 = no issues found, 10 = severe structural problems.

### Scoring rubric per concept

- **0-2 (Clean):** No violations or minor style issues only.
- **3-4 (Minor):** A few isolated violations. No systemic pattern.
- **5-6 (Moderate):** Clear pattern of violations across multiple files. Likely causes maintenance friction.
- **7-8 (Significant):** Widespread violations. Production incidents probable under load or over time.
- **9-10 (Critical):** Systemic failure in this dimension. Immediate remediation needed.

### Scoring signals

When scoring, weigh these factors:
- **Frequency:** How many files/components are affected?
- **Severity:** Does this cause bugs, security holes, or just readability issues?
- **Systemic nature:** Is it a pattern or an isolated case?
- **Blast radius:** If this fails, how much of the app breaks?

## Weighted Fragility Score (0-100)

Not all concepts contribute equally to production failure risk. Weights reflect the empirical data from the research:

| Concept | Weight | Rationale |
|---------|--------|-----------|
| Error Flow | 12% | 43% of AI code needs production debugging (Lightrun 2026) |
| State | 12% | Incidents/PR tripled, churn 10× (Faros 2026) |
| Side Effects | 10% | 76% of AI PRs lack timeouts (CodeRCops) |
| Input/Output | 10% | 86% XSS failure rate (Georgia Tech), 45% OWASP violations (Veracode) |
| Abstraction | 9% | Refactoring dropped 74%, duplication up 81% (GitClear 2026) |
| Modularity | 9% | 41% complexity increase post-AI adoption (He et al.) |
| Scope | 8% | 35 CVEs in one month from AI code (CSA) |
| Control Flow | 7% | CC>10 makes functions untestable (Kashif et al.) |
| Architecture | 7% | 91% correct but structurally broken (Kashif et al.) |
| Data Flow | 6% | Duplication up 81% but less directly dangerous (GitClear) |
| Req/Res Cycle | 5% | Cache stampedes, retry storms (SO Blog) |
| Concurrency | 5% | 54% more bugs/dev (Faros) but less common in frontend-only |

**Formula:**
```
Fragility Score = Σ (concept_score × weight × 10)
```

Example: If Error Flow scores 7/10 with weight 12%, it contributes 7 × 0.12 × 10 = 8.4 points.

## Grade Mapping

| Score | Grade | Meaning |
|-------|-------|---------|
| 0-20 | A | Structurally sound. Minor issues only. |
| 21-40 | B | Good foundation. Some patterns need attention. |
| 41-60 | C | Moderate fragility. Maintenance cost will compound. |
| 61-80 | D | Significant structural debt. Production incidents likely. |
| 81-100 | F | Critical. Architectural intervention required before scaling. |
