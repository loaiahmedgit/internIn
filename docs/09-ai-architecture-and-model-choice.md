# AI Architecture & Model Choice

## Provider abstraction

Build an `AIProvider` abstraction layer, not a direct dependency on one model vendor. Concrete functions sit on top of it: `generateInternship()`, `generateChallenge()`, `generateSyntheticScenario()`, `editChallenge()`, `generateRubric()`, `summarizeCandidate()`, `compareCandidates()`, `generateInternshipProgram()`.

Guiding rule: **internIn uses AI** — it should never be architected as "a Gemma app" (or a GPT app, or a Claude app). If a dramatically better model becomes available later, only the provider implementation should need to change, not the product.

## Gemma 4 model evaluation

**Gemma 4 31B** (dense): 30.7B parameters, 256K context, image understanding, configurable reasoning, native function calling, multilingual training across 140+ languages, Apache 2.0 license. Strong reasoning/coding/vision benchmarks; positioned as one of Google's highest-performing open models as of its April 2026 release. Well suited to: challenge generation, Arabic + English support, rubric generation, structured JSON output, candidate summaries, document/image understanding, internship-plan generation, agent/tool calling. Verdict: reasonable default choice for internIn.

**Gemma 4 26B A4B** (mixture-of-experts): 25.2B total parameters but only 3.8B active parameters per token, making it substantially faster than the dense 31B while staying close in quality (e.g. MMLU Pro 82.6 vs 85.2, AIME 2026 88.3 vs 89.2, GPQA Diamond 82.3 vs 84.3, MMMU Pro 73.8 vs 76.9 for 31B). Cheaper too: OpenRouter listed roughly $0.06/M input and $0.33/M output for 26B A4B vs about $0.08/M input and $0.35/M output for 31B.

## Recommended split during development

Use **Gemma 4 31B** for complex/high-value generation: Challenge generation, rubric generation, candidate comparison, complex planning.

Use **Gemma 4 26B A4B** for lighter-weight, higher-volume tasks: AI chat, editing, matching explanations, simple summaries, routine generation.

If 26B A4B output proves indistinguishable in practice, migrate most traffic to it for cost efficiency. Either way, the AI provider abstraction keeps the bill from being a meaningful driver of the business model.
