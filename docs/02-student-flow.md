# Student Flow

## Student profile

Kept intentionally simple: Name, University, Major, Graduation year, Interests, Skills, Availability, CV (optional).

Guiding philosophy: internIn shouldn't punish someone for not already having an impressive CV — that would defeat the entire point of the product. The core promise is "Don't tell them what you can do. Show them."

## Discover internships / Smart matching

Homepage shows "Recommended for you" with match percentages, e.g.:
- Data Analyst Intern — Company X, 87% match, Hybrid, Doha, 8 weeks
- Marketing Intern — Company Y, 82% match, On-site, Doha, 6 weeks

Matching uses student major + interests + skills + availability + Challenge requirements. Important rule: the match score must NOT determine whether a student is allowed to apply — it's guidance, not a gate.

## Challenge Workspace

The student's challenge workspace is a premium part of the product. It shows: Company, Role, Challenge, Problem, Files, Instructions, Deliverables, Time expectation, and a Submit Work action.

## AI-usage modes (company-configured per challenge)

- **Open mode**: internet/AI allowed
- **AI allowed**: explicitly permitted
- **Restricted AI**: certain resources limited
- **Controlled assessment**: stricter conditions

Some companies don't care about AI use ("everybody here uses AI"); others want to test fundamentals without AI assistance. This setting belongs to the company, per challenge.

Do NOT build webcam/locked-browser proctoring in the MVP — added later only as an advanced company option, due to privacy, legal, and technical complexity.

## Practice / training layer (later, not MVP)

If a student underperforms, instead of a flat rejection, internIn can say "You're not ready yet" and generate practice content based on the *type* of skill companies repeatedly test (e.g. SQL joins, data cleaning, Excel, business reasoning) — never exposing real company challenge content. Loop: Learn → Practice → Prove → Internship. Do not build the full learning platform in v1.
