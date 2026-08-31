# UI Implementation Rules

- Always check the `components.json` configuration file before generating UI elements.
- Use `shadcn/ui` atomic elements (Button, Dialog, Card, Input) rather than raw HTML.
- Always use utility classes mapping to Tailwind CSS design tokens rather than hardcoded hex colors or pixels.
- Use Lucide React icons for all graphical UI representations.
- Always use the installed shadcn MCP to inspect available components, patterns, blocks, and examples before building a custom component.
- Prefer composing existing shadcn primitives over creating custom UI primitives from scratch.
- Do not use default shadcn styling blindly. Adapt shadcn components to the internIn design language.
- Preserve the internIn design system: clean white surfaces, navy typography, teal brand accents, subtle borders, restrained radius, minimal shadows.
- Do not introduce arbitrary colors, gradients, oversized headings, or decorative UI without a product reason.
- Reuse established components and spacing patterns across screens.
- Use screenshots/reference designs as the visual source of truth when provided.
- Use responsive layouts, proper focus states, keyboard accessibility, and semantic structure.
- Never use emoji as interface icons.
