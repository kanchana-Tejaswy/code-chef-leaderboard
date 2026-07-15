# Data Cleaning Dry-Run Audit Report

This report outlines data-quality anomalies identified in the student profile registry and platform records.

## Summary of Issues Found

Total Issues Detected: **4**

| Issue Type | Affected ID | Field | Current Value | Proposed Value | Risk | Action Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| LEADERBOARD_STARS_MISMATCH | `fff6fdf6-547f-4759-a9dc-14ea39cbee03` | `stars` | `1` | `0` | Low | **APPLY** |
| LEADERBOARD_STARS_MISMATCH | `22222222-2222-2222-2222-222222222222` | `stars` | `1` | `0` | Low | **APPLY** |
| LEADERBOARD_STARS_MISMATCH | `33333333-3333-3333-3333-333333333333` | `stars` | `1` | `0` | Low | **APPLY** |
| LEADERBOARD_STARS_MISMATCH | `44444444-4444-4444-4444-444444444444` | `stars` | `1` | `0` | Low | **APPLY** |


## Recommendations Details

### 1. LEADERBOARD_STARS_MISMATCH on ID `fff6fdf6-547f-4759-a9dc-14ea39cbee03`
- **Field**: `stars`
- **Reason**: Leaderboard stars cache (1) mismatch with CodeChef Profile (0)
- **Risk Category**: Low
- **Proposed Mitigation**: 0
- **Action Recommendation**: APPLY

### 2. LEADERBOARD_STARS_MISMATCH on ID `22222222-2222-2222-2222-222222222222`
- **Field**: `stars`
- **Reason**: Leaderboard stars cache (1) mismatch with CodeChef Profile (0)
- **Risk Category**: Low
- **Proposed Mitigation**: 0
- **Action Recommendation**: APPLY

### 3. LEADERBOARD_STARS_MISMATCH on ID `33333333-3333-3333-3333-333333333333`
- **Field**: `stars`
- **Reason**: Leaderboard stars cache (1) mismatch with CodeChef Profile (0)
- **Risk Category**: Low
- **Proposed Mitigation**: 0
- **Action Recommendation**: APPLY

### 4. LEADERBOARD_STARS_MISMATCH on ID `44444444-4444-4444-4444-444444444444`
- **Field**: `stars`
- **Reason**: Leaderboard stars cache (1) mismatch with CodeChef Profile (0)
- **Risk Category**: Low
- **Proposed Mitigation**: 0
- **Action Recommendation**: APPLY

