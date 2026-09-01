"use client";

import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire";
import type { ClarificationQuestionsResult } from "@/lib/ai/challenge-clarification-schemas";

const OTHER_VALUE = "__other__";

/**
 * Renders Ask internIn's clarification questions using the real shadcn
 * Questionnaire primitive — no hand-rolled radio/checkbox UI. The model
 * only ever produces the validated ClarificationQuestionsResult data;
 * this component owns every pixel of how it's presented.
 */
export function AskInternInQuestionnaire({
  result,
  onSubmit,
  disabled,
}: {
  result: ClarificationQuestionsResult;
  onSubmit: (answersSummary: string) => void;
  disabled?: boolean;
}) {
  const items = result.questions.map((q) => ({
    name: q.id,
    required: q.required,
    choices: q.choices?.map((c) => ({ value: c.value })),
  }));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const lines = result.questions.map((q) => {
      const raw = q.type === "multiple" ? formData.getAll(q.id).map(String) : [String(formData.get(q.id) ?? "")];
      const answered = raw
        .filter(Boolean)
        .map((v) => (v === OTHER_VALUE ? null : (q.choices?.find((c) => c.value === v)?.label ?? v)))
        .filter((v): v is string => v !== null);
      return `${q.prompt} — ${answered.length ? answered.join(", ") : "(skipped)"}`;
    });
    onSubmit(`Here are my answers:\n${lines.join("\n")}`);
  }

  return (
    <div className="not-typeset rounded-xl border border-navy/10 bg-white p-4 sm:p-5">
      <Questionnaire items={items} onSubmit={handleSubmit} className="gap-5">
        <QuestionnaireProgress />
        {result.questions.map((q) => (
          <QuestionnaireItem key={q.id} name={q.id} required={q.required} multiple={q.type === "multiple"}>
            <QuestionnaireTitle>{q.prompt}</QuestionnaireTitle>
            {q.description && <QuestionnaireDescription>{q.description}</QuestionnaireDescription>}
            {q.choices && q.choices.length > 0 ? (
              <QuestionnaireChoices>
                {q.choices.map((c) => (
                  <QuestionnaireChoice key={c.value} value={c.value}>
                    <span className="font-medium">{c.label}</span>
                    {c.description && <QuestionnaireChoiceDescription>{c.description}</QuestionnaireChoiceDescription>}
                  </QuestionnaireChoice>
                ))}
                {q.allowOther && (
                  <QuestionnaireChoice value={OTHER_VALUE}>
                    <span className="font-medium">Something else</span>
                    <QuestionnaireInput aria-label="Describe in your own words" placeholder="Type your answer…" />
                  </QuestionnaireChoice>
                )}
              </QuestionnaireChoices>
            ) : (
              <QuestionnaireInput aria-label={q.prompt} placeholder="Type your answer…" />
            )}
            <QuestionnaireError />
          </QuestionnaireItem>
        ))}
        <QuestionnaireActions>
          <QuestionnairePrevious />
          <QuestionnaireSkip />
          <QuestionnaireNext />
          <QuestionnaireSubmit disabled={disabled}>{disabled ? "Sending…" : "Submit"}</QuestionnaireSubmit>
        </QuestionnaireActions>
      </Questionnaire>
    </div>
  );
}
