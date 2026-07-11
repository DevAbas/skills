# Interview Framework

> The structure that turns a vague prompt into a senior answer. Reference material for the fe-architect skill. Load for frontend system-design interview prep and for structuring any architecture answer.

## RADIO: Frontend System Design Framework

**One-liner:** Requirements → Architecture → Data → Interface → Optimizations: a five-step scaffold for the design round.

**What RADIO stands for:** **R**equirements → **A**rchitecture → **D**ata model → **I**nterface (API) → **O**ptimizations. A repeatable scaffold for any frontend system design round: scope before you build, then spend the most time where it counts. Following it keeps a 45-minute interview from sprawling.

**The five stages:**
1. **Requirements (~15%)**: Clarify functional scope, non-functional needs (performance, a11y, i18n, devices), and constraints. Restate them, get agreement, and call what's **out** of scope.
2. **Architecture (~20%)**: Sketch the component tree and major boxes (client, BFF, services). Name responsibilities and how components compose. This is where you draw.
3. **Data model (~15%)**: Define entities, fields, and which component **owns** vs **renders** each. Separate server state from client/UI state.
4. **Interface / API (~15%)**: Specify the contracts: the network API (endpoints, shapes, pagination) and the component API (props/events).
5. **Optimizations (~35%)**: Performance (CWV, virtualization, code-splitting), accessibility, error/loading/empty states, and the interviewer's follow-ups. Where seniority shows.

**How to apply:**
- Model requirements as data in the first five minutes. A checklist of `functional`, `nonFunctional`, and `outOfScope` is the artifact you confirm before drawing a single box.
- Restate requirements back and get agreement before designing; saying what's **out of scope** out loud is the highest-signal sentence in the round.
- In the data model, distinguish **server state** from **client/UI state**, and name which component *owns* vs *renders* each entity.
- Spend the most time on **Optimizations (~35%)**. Performance, a11y, and error/loading/empty states are where seniority shows.
- Treat the percentages as defaults and **reallocate** to whatever the interviewer probes; keep RADIO as invisible scaffolding and narrate it out loud rather than reciting the acronym.

**Key terms:**
- **Functional requirements**: What the user can do, the features in scope.
- **Non-functional requirements**: Qualities the system must have: performance, accessibility, i18n, offline, device support.
- **Deep dive**: A focused exploration of one sub-problem (e.g. infinite scroll) where you demonstrate depth.

**Pitfalls:**
- Jumping to components before agreeing on requirements. You design the wrong thing fast.
- Spending 20 minutes on requirements and never reaching optimizations.
- Forgetting non-functional requirements (a11y, i18n, error states) until prompted.
- Designing in silence. The framework only helps if you narrate it.
- Reciting the acronym mechanically reads as junior; keep it as invisible scaffolding, time-boxed and reallocated to what the interviewer probes.

**Interview angle:** "Scope with RADIO: requirements, architecture, data, contracts. Then spend most time on optimizations and the deep dive they care about."

**Related:** `rendering-strategies`, `infinite-scroll-feed`

**Deep dive:** https://fearchitect.com/topics/radio-interview-framework
