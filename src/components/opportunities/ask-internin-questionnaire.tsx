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
import type { QuestionnaireAnswer } from "@/lib/ai/assistant-messages";

const OTHER_VALUE = "__other__";

/**
 * Renders Ask internIn's clarification questions using the real shadcn
 * Questionnaire primitive — no hand-rolled radio/checkbox UI. The model
 * only ever produces the validated ClarificationQuestionsResult data;
 * this component owns every pixel of how it's presented.
 *
 * `onSubmit` receives structured answers, never a giant serialized chat
 * bubble — the Questionnaire itself already visually represents what was
 * answered; the conversation shows a compact acknowledgement instead (see
 * assistant-workspace.tsx). A skipped optional question reports `answer:
 * null`, never a placeholder string.
 */
export function AskInternInQuestionnaire({
  result,
  onSubmit,
  disabled,
}: {
  result: ClarificationQuestionsResult;
  onSubmit: (answers: QuestionnaireAnswer[]) => void;
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
    const answers: QuestionnaireAnswer[] = result.questions.map((q) => {
      const raw = q.type === "multiple" ? formData.getAll(q.id).map(String) : [String(formData.get(q.id) ?? "")];
      const answered = raw
        .filter(Boolean)
        .map((v) => (v === OTHER_VALUE ? null : (q.choices?.find((c) => c.value === v)?.label ?? v)))
        .filter((v): v is string => v !== null);
      return { prompt: q.prompt, answer: answered.length ? answered.join(", ") : null };
    });
    onSubmit(answers);
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
