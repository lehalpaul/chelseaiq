import { tool } from "ai";
import { z } from "zod";

export const addAnalysisStep = tool({
  description:
    "Surface an intermediate finding for the UI during multi-step analysis. Use for concise factual summaries between tool calls.",
  inputSchema: z.object({
    title: z.string().describe("Short title for the analysis step."),
    content: z
      .string()
      .describe("Concise factual finding based on retrieved tool data."),
    nextStep: z
      .enum(["continue", "finalAnswer"])
      .describe("Whether the assistant will continue analysis or provide the final answer next."),
  }),
  execute: async (input) => input,
});
