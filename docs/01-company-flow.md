# Company Flow

## A. Create an internship

Company creates an opportunity, e.g. "Data Analyst Intern," with fields: Role, Duration, Hours/week, Location, Slots, Skills, Description.

Rather than a giant HR form, the company uses **Build with AI**: the manager describes the role in natural language (e.g. "We need a university student who can clean sales data, use basic SQL and explain insights clearly"). The AI asks 3-5 intelligent follow-up questions, then generates the internship listing.

## B. Challenge Builder (the killer feature)

After creating the internship, the manager creates a **Work Challenge**. They describe what the intern would actually do, e.g. "Our analysts receive sales files and have to figure out why certain product categories perform badly."

The AI produces a **safe simulated version** of that real work:
- synthetic data
- fictional company/customer information
- realistic scenario
- instructions
- expected deliverables
- recommended duration
- skills being tested
- evaluation rubric

This means the company never has to expose confidential internal data to applicants.

Example output — "Sales Performance Challenge": a fictional retail company whose electronics category declined 14% this quarter; provided files `transactions.xlsx`, `products.csv`, `brief.pdf`; deliverable is analysis + dashboard + recommendations; estimated time 75 minutes.

## Challenge editor

Should feel like Notion × Canva × AI — extremely easy, not enterprise HR software. Manager can edit anything manually, or tell the AI:
- "Make it easier."
- "Replace Python with Excel."
- "Focus more on reasoning."
- "Give them 90 minutes."
- "Remove question 3."
- "Create synthetic data with 5,000 rows."

The AI updates the Challenge accordingly. AI proposes, the company controls.

## Role-specific challenge types

internIn is not limited to developer assessment (avoid becoming "HackerRank"). Challenge type adapts to role:

- Developer: build/fix something
- Designer: respond to a design brief
- Marketing: analyze campaign performance / propose a strategy
- Finance: analyze financial statements
- Business: solve a business case
- Data: analyze a dataset
- HR: handle an employee scenario
- Sales: respond to a simulated client
- Research: investigate a market and present findings

This range is what gives internIn a market larger than developer-only assessment tools.

## Reviewing candidates

After students submit, the company sees Candidate Evidence and can run Candidate Comparison, then Invite to Internship (see 03-candidate-evidence-and-comparison.md).
