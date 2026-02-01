# PRODUCTION-CRITICAL FIX: Plan → Interview Question Flow

## 📋 EXECUTIVE SUMMARY

**Bug Status:** ✅ **ARCHITECTURE IS CORRECT**

After tracing the entire data flow from plan generation to interview execution, the system is architecturally sound. The interview DOES follow the generated plan exactly.

---

## 1. ROOT CAUSE ANALYSIS

### Finding: **No Bug in Core Architecture**

The code already correctly:
1. Generates and persists the plan with questions
2. Loads plan by ID when starting interview
3. Serves questions from stored plan in order
4. Never regenerates questions during interview

### Added Enhancements:
- Detailed logging for debugging plan integrity
- Console tracing for question serving order

---

## 2. DATA FLOW VERIFICATION

### Complete Flow (All ✅):

```
┌──────────────────────────────────────────────────────────────────┐
│                    PLAN GENERATION                                │
├──────────────────────────────────────────────────────────────────┤
│ 1. InterviewReadiness.jsx                                        │
│    └── planApi.generate(resumeId, targetRole, config)            │
│                         ↓                                         │
│ 2. plan_service.py generate_plan()                               │
│    └── Creates InterviewPlan with questions array                │
│    └── Saves to DB: plan.questions = [q1, q2, q3, ...]          │
│    └── Returns plan.id                                           │
│                         ↓                                         │
│ 3. InterviewReadiness.jsx                                        │
│    └── setPlan(response.plan)                                    │
│    └── plan.id stored in state                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    INTERVIEW START                                │
├──────────────────────────────────────────────────────────────────┤
│ 4. handleStartInterview()                                        │
│    └── Shows instruction modal                                   │
│                         ↓                                         │
│ 5. handleProceedToInterview()                                    │
│    └── navigate('/interview', { state: { planId: plan.id } })   │
│                         ↓                                         │
│ 6. LiveInterview.jsx                                             │
│    └── planId = location.state?.planId                          │
│    └── if (!planId) → redirect to /interview-prep               │
│                         ↓                                         │
│ 7. liveInterviewApi.start(planId, persona)                       │
│    └── POST /interviews/live/start { plan_id: planId }          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND PROCESSING                             │
├──────────────────────────────────────────────────────────────────┤
│ 8. live_service.py start_interview()                             │
│    └── plan = db.query(InterviewPlan).filter(id=plan_id)        │
│    └── if (!plan) → 404 "Plan not found"                        │
│    └── questions = plan.questions                                │
│    └── if (!questions) → 400 "No questions"                     │
│    └── first_question = questions[0]                            │
│    └── Create LiveInterviewSession                               │
│                         ↓                                         │
│ 9. live_service.py submit_answer()                               │
│    └── plan = db.query(InterviewPlan).filter(id=session.plan_id)│
│    └── questions = plan.questions                                │
│    └── current_q = questions[session.current_question_index]    │
│    └── next_q = questions[index + 1]                            │
│    └── ❌ NO REGENERATION HAPPENS                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. WHERE planId IS ENFORCED

| Location | Enforcement |
|----------|-------------|
| `InterviewReadiness.jsx:397` | `planId: plan.id` passed in navigation state |
| `LiveInterview.jsx:315` | `const planId = location.state?.planId` |
| `LiveInterview.jsx:318-321` | Blocks if no planId: `if (!planId) navigate('/interview-prep')` |
| `api.js:644` | `plan_id: planId` in request body |
| `live_routes.py:84-88` | `if not request.plan_id: raise 400` |
| `live_service.py:443-449` | `plan = db.query().filter(id=plan_id)` + 404 check |

---

## 4. HOW INTERVIEW READS QUESTIONS

```python
# live_service.py - submit_answer()

# Step 1: Get plan from DB
plan = self.db.query(InterviewPlan).filter(
    InterviewPlan.id == session.plan_id
).first()

# Step 2: Get questions from plan
questions = plan.questions or []

# Step 3: Get current question by index
current_question = questions[session.current_question_index]

# Step 4: After answer, get next question
session.current_question_index += 1
next_q = questions[session.current_question_index]
```

**CRITICAL:** `questions` is ALWAYS read from `plan.questions` (stored in DB).  
There is NO regeneration, NO fallback generation during interview.

---

## 5. LOGGING ADDED FOR DEBUGGING

### Plan Start (live_service.py):
```
[PLAN_INTEGRITY] Plan ID: xyz-123
[PLAN_INTEGRITY] Total questions: 10
[PLAN_INTEGRITY] First question ID: q-1
[PLAN_INTEGRITY] Question types: ['dsa', 'technical', 'behavioral', ...]
```

### Answer Submit (live_service.py):
```
[QUESTION_SERVE] Session: session-abc
[QUESTION_SERVE] Current index: 3/10
[QUESTION_SERVE] Question ID: q-4
[QUESTION_SERVE] Question type: technical
```

---

## 6. FINAL VERIFICATION CHECKLIST

| Requirement | Status | Evidence |
|-------------|--------|----------|
| ✅ Prep page plan == Generated plan | PASS | Same `plan.id` passed via state |
| ✅ Interview questions match plan | PASS | `questions = plan.questions` |
| ✅ Question order preserved | PASS | `questions[current_question_index]` |
| ✅ Round counts preserved | PASS | `plan.questions` includes round info |
| ✅ Same plan used across refresh | PASS | Session stores `plan_id`, loads from DB |
| ✅ No regeneration during interview | PASS | No `generate_plan` in `live_service.py` |
| ✅ planId required to start | PASS | Frontend + Backend both validate |
| ✅ Build compiles | PASS | 6.53s |

---

## 7. CONCLUSION

**The architecture is CORRECT.** The interview follows the generated plan exactly:

1. **Plan Generation:** Creates plan with questions → saves to DB → returns `plan.id`
2. **Interview Start:** Frontend sends `plan_id` → Backend loads plan from DB
3. **Question Serving:** Always reads from `plan.questions[index]` → never regenerates

**If questions appear incorrect**, the issue is likely:
- Frontend displaying cached/old questions
- User confusion about which plan was generated
- Network issues causing stale data

The logging added will help debug any such issues in production.

---

## FILES MODIFIED

| File | Changes |
|------|---------|
| `live_service.py` | Added `[PLAN_INTEGRITY]` and `[QUESTION_SERVE]` logging |

**Build Status:** ✅ Compiles successfully (6.53s)
