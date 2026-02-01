# CRITICAL BUG FIX: Interview Plan Consistency

## Date: December 23, 2024
## Severity: CRITICAL

---

## Problem Statement

**LEFT CONFIG (User's Selection):**
- DSA = 1
- Technical = 1
- Behavioral = 1
- HR = 1
- **Total = 4 questions**

**RIGHT PREVIEW (Backend Response):**
- Technical = 3
- Behavioral = 3
- HR = 3
- Situational = 2
- **Total = 11 questions**

**MISMATCH!** The user's configuration was NOT being sent to the backend.

---

## Root Cause Analysis

### Issue 1: Frontend API Client Not Sending `round_config`

**File:** `frontend/src/services/api.js` (line 586-597)

The `planApi.generate()` function was **NOT including `round_config`** in the request body:

```javascript
// BEFORE (BROKEN)
body: JSON.stringify({
    target_role: targetRole,
    session_type: options.sessionType || 'mixed',
    difficulty_level: options.difficultyLevel || 'medium',
    question_count: options.questionCount || 10,
    company_mode: options.companyMode || null,
    // MISSING: round_config ❌
}),
```

The frontend was passing `options.roundConfig` but the API client dropped it!

### Issue 2: DSA Questions Lumped into Technical

**File:** `backend/app/interviews/plan_service.py` (line 391)

DSA questions were being counted as "technical":

```python
# BEFORE (BROKEN)
tech_count = sum(1 for q in questions if q["type"] in ["technical", "dsa", "system_design"])
```

This caused DSA to disappear from the breakdown and Technical to show incorrect count.

### Issue 3: No `dsa` Field in Breakdown Schema

**File:** `backend/app/interviews/plan_schemas.py`

The `QuestionBreakdown` schema only had: `{technical, behavioral, hr, situational}`

DSA was NOT represented, so even if correctly counted, it couldn't be displayed.

---

## Fixes Applied

### Fix 1: Add `round_config` to API Request

**File:** `frontend/src/services/api.js`

```javascript
// AFTER (FIXED)
body: JSON.stringify({
    target_role: targetRole,
    session_type: options.sessionType || 'mixed',
    difficulty_level: options.difficultyLevel || 'medium',
    question_count: options.questionCount || 10,
    company_mode: options.companyMode || null,
    round_config: options.roundConfig || null,  // ✅ NOW INCLUDED
}),
```

### Fix 2: Separate DSA Count from Technical

**File:** `backend/app/interviews/plan_service.py`

```python
# AFTER (FIXED)
dsa_count = sum(1 for q in questions if q["type"] == "dsa")
tech_count = sum(1 for q in questions if q["type"] in ["technical", "system_design"])
# ...
return {
    "dsa_question_count": dsa_count,  # ✅ SEPARATE
    "technical_question_count": tech_count,
    # ...
}
```

### Fix 3: Add `dsa` to QuestionBreakdown Schema

**File:** `backend/app/interviews/plan_schemas.py`

```python
class QuestionBreakdown(BaseModel):
    dsa: int = Field(default=0, ge=0)  # ✅ NEW
    technical: int = Field(default=0, ge=0)
    behavioral: int = Field(default=0, ge=0)
    hr: int = Field(default=0, ge=0)
    situational: int = Field(default=0, ge=0)
```

### Fix 4: Add `dsa_question_count` to Model

**File:** `backend/app/interviews/plan_models.py`

```python
dsa_question_count = Column(Integer, default=0)  # ✅ NEW
technical_question_count = Column(Integer, default=0)
```

### Fix 5: Update Response Builders

**File:** `backend/app/interviews/plan_routes.py`

```python
breakdown=QuestionBreakdown(
    dsa=getattr(plan, 'dsa_question_count', 0) or 0,  # ✅ INCLUDED
    technical=plan.technical_question_count or 0,
    # ...
)
```

### Fix 6: Add DSA Icon to Frontend

**File:** `frontend/src/components/InterviewPlanPreview.jsx`

```javascript
case 'dsa': return '🧮';  // ✅ NEW ICON
```

### Fix 7: Add Database Migration for DSA Column

**File:** `backend/app/db/session.py`

The existing SQLite database didn't have the new `dsa_question_count` column. Added it to the migration list:

```python
("dsa_question_count", "INTEGER DEFAULT 0"),
```

The server will now automatically add this column on startup.

---

## Data Flow After Fix

```
User Config:                 API Request:              Backend:                  Response:
┌────────────────┐          ┌────────────────┐        ┌────────────────┐        ┌────────────────┐
│ DSA: 1         │ ──────▶  │ round_config:  │ ────▶  │ Generate Plan  │ ────▶  │ breakdown:     │
│ Technical: 1   │          │   dsa: 1       │        │ with exact     │        │   dsa: 1       │
│ Behavioral: 1  │          │   tech: 1      │        │ user counts    │        │   technical: 1 │
│ HR: 1          │          │   behav: 1     │        │                │        │   behavioral: 1│
│ ─────────────  │          │   hr: 1        │        │                │        │   hr: 1        │
│ Total: 4       │          └────────────────┘        └────────────────┘        │ ──────────────│
└────────────────┘                                                               │ Total: 4      │
                                                                                 └────────────────┘
                              ✅ MATCH                     ✅ MATCH                  ✅ MATCH
```

---

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/services/api.js` | Added `round_config` to request body |
| `backend/app/interviews/plan_schemas.py` | Added `dsa` field to QuestionBreakdown |
| `backend/app/interviews/plan_models.py` | Added `dsa_question_count` column |
| `backend/app/interviews/plan_routes.py` | Updated breakdown to include DSA |
| `backend/app/interviews/plan_service.py` | Fixed count calculation, added `dsa_question_count` |
| `frontend/src/components/InterviewPlanPreview.jsx` | Added DSA icon |

---

## Verification Checklist

After this fix:

| Check | Expected | Status |
|-------|----------|--------|
| Left config = 4 questions | DSA:1 + Tech:1 + Behav:1 + HR:1 = 4 | ✅ |
| Right preview = 4 questions | Same breakdown | ✅ |
| Refresh preserves data | Plan stored in DB | ✅ |
| Navigation preserves data | planId passed in state | ✅ |
| Interview uses same plan | Questions from plan.questions | ✅ |
| No hidden "situational" | Only if user selected | ✅ |

---

## Build Status

| Component | Result |
|-----------|--------|
| Backend | ✅ Compiles OK |
| Frontend | ✅ Builds in 6.31s |

---

## Summary

**Root Cause:** The frontend API client was NOT sending `round_config` to the backend, causing the backend to use default question distribution instead of the user's selection.

**Fix:** Added `round_config` to the API request and properly tracked DSA questions separately from Technical questions throughout the entire data pipeline.
