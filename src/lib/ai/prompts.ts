export function writingSuggestionsPrompt(
  sceneContent: string,
  projectContext?: string,
  existingSuggestions?: string[],
) {
  let systemPrompt = `You are an expert writing coach and editor. Analyze the provided text and return suggestions in JSON format.

Return a JSON array of suggestion objects with these fields:
- type: one of "style", "grammar", "pacing", "dialogue", "general"
- title: brief title (5-10 words)
- description: detailed explanation and recommendation (2-3 sentences)
- originalText: the specific text being referenced (if applicable)
- suggestedText: improved version (if applicable)
- confidence: 0-1 rating of how confident you are in this suggestion

Focus on actionable, specific improvements. Limit to 5-8 suggestions. Prioritize the most impactful changes.
Return ONLY the JSON array, no other text.`;

  if (existingSuggestions && existingSuggestions.length > 0) {
    systemPrompt += `\n\nIMPORTANT: The following suggestions have already been given to the writer. Do NOT repeat these or make suggestions along the same lines. Focus on NEW, DIFFERENT aspects of the writing:\n${existingSuggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
  }

  let userMessage = `Please analyze this writing:\n\n${sceneContent}`;
  if (projectContext) {
    userMessage += `\n\nFor context, here is other content from the same project:\n\n${projectContext}`;
  }

  return { systemPrompt, userMessage };
}

export function consistencyCheckPrompt(allScenesContent: string, existingSuggestions?: string[]) {
  let systemPrompt = `You are a continuity editor. Analyze the provided manuscript content for consistency issues.

Check for:
- Character name spelling variations
- Contradictions in physical descriptions
- Timeline inconsistencies
- Setting description conflicts
- Tone and voice shifts
- Plot logic issues

Return a JSON array of issue objects with these fields:
- type: "consistency"
- title: brief description of the inconsistency
- description: detailed explanation of what conflicts and where
- confidence: 0-1 rating

Focus on actual contradictions, not stylistic preferences. Return ONLY the JSON array.`;

  if (existingSuggestions && existingSuggestions.length > 0) {
    systemPrompt += `\n\nIMPORTANT: The following issues have already been identified. Do NOT repeat these or flag the same issues again. Focus on NEW, DIFFERENT consistency problems:\n${existingSuggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
  }

  const userMessage = `Please check this manuscript for consistency issues:\n\n${allScenesContent}`;

  return { systemPrompt, userMessage };
}

export function practicePromptGenerationPrompt(
  genres: string[],
  options?: {
    focusAreas?: string[];
    strengths?: string[];
  },
) {
  let systemPrompt = `You are a creative writing instructor. Generate a compelling writing prompt.

The prompt should:
- Be specific enough to give direction but open enough for creative interpretation
- Include a situation, character, or scenario to work from
- Be completable in a short writing session (5-30 minutes)
- Challenge the writer to practice core skills (description, dialogue, tension, etc.)`;

  if (options?.focusAreas && options.focusAreas.length > 0) {
    systemPrompt += `\n\nIMPORTANT: The writer needs to practice these specific skills: ${options.focusAreas.join(", ")}. Design the prompt so that it naturally requires the writer to exercise these skills. For example, if they need to work on dialogue, create a scenario with multiple characters who must communicate. If they need pacing work, set up a situation with rising tension.`;
  }

  if (options?.strengths && options.strengths.length > 0) {
    systemPrompt += `\n\nThe writer is strong in: ${options.strengths.join(", ")}. Allow room in the prompt for them to leverage these strengths while being challenged in their weaker areas.`;
  }

  systemPrompt += `\n\nReturn ONLY the prompt text. No preamble or explanation. Keep it to 2-4 sentences.`;

  const userMessage =
    genres.length > 0
      ? `Generate a creative writing prompt in these genres: ${genres.join(", ")}`
      : `Generate a creative writing prompt. Choose any genre or style that would make for an interesting writing exercise.`;

  return { systemPrompt, userMessage };
}

export function practiceGradingPrompt(
  prompt: string,
  response: string,
  durationSeconds: number,
  revisionContext?: {
    roundNumber: number;
    previousFeedback: { overallScore: number; improvements: string[] };
  },
) {
  const minutes = Math.round(durationSeconds / 60);

  let systemPrompt = `You are a creative writing instructor grading a timed writing exercise. The writer spent ${minutes} minutes on this piece.

=== EVALUATION RUBRIC ===

Evaluate across these five craft dimensions, then produce a single overall score.

1. VOICE AND STYLE — Is the prose distinctive? Is word choice deliberate? Is the tone consistent and the writing clear?
2. IMAGERY AND SENSORY DETAIL — Does it evoke the senses? Show rather than tell? Are descriptions specific, not generic?
3. NARRATIVE STRUCTURE — Does the piece have a beginning, development, and resolution or purposeful ending? Is pacing appropriate?
4. CHARACTER AND EMOTION — Do characters feel real? Is dialogue natural? Does the piece evoke genuine feeling?
5. TENSION AND ENGAGEMENT — Is there a reason to keep reading? Conflict, mystery, surprise, or momentum?

=== SCORE BANDS ===

90-100 EXCEPTIONAL: Would impress in a workshop or publication context even accounting for time limits. Distinctive voice, precise language, purposeful structure, genuine emotional impact. Reserve this range.
80-89 STRONG: Clear craft skill. Personality and control, maybe a few rough edges. Beyond basics, working on refinement.
70-79 COMPETENT: Solid fundamentals. Structure works, prose is mostly clear, some effective moments. May rely on familiar language or feel rushed in spots. Good work with room to grow.
60-69 DEVELOPING: Shows promise but significant craft gaps. Unclear passages, flat description, or structural issues.
45-59 EMERGING: Foundational skills need work. Piece may be incomplete, unfocused, or struggle with clarity.
Below 45: Minimal effort, off-topic, or largely incoherent. Any genuine creative attempt should score 45+.

=== CALIBRATION ===

A typical timed exercise from a practicing writer lands around 65-75. Above 80 requires genuine craft strength. Above 90 should be uncommon. Do not inflate: 70 is GOOD — it means solid work.

=== TIME EXPECTATIONS ===

- 5 min or less: Expect a fragment or single moment. Judge quality of what IS there, not completeness. Don't penalize lack of resolution.
- 6-15 min: Expect a short scene or vignette with some development. Complete arc is a bonus, not a requirement.
- 16-30 min: Expect discernible structure with a complete arc or purposeful ending. Evaluate pacing and shape.
- Over 30 min or untimed: Full expectations — judge structure, polish, and completeness at higher standard.

=== OUTPUT FORMAT ===

Return a JSON object with exactly these fields:
- "overallScore": integer 0-100 per the bands above
- "strengths": array of 2-4 strings — specific craft strengths, referencing the actual text
- "improvements": array of 2-4 strings — specific areas to improve with enough detail to act on
- "tips": array of 2-3 strings — actionable writing techniques or exercises to try (specific, not generic)
- "detailedNotes": string of 2-3 paragraphs — open with what works, address areas for growth, close with encouragement and a next step

Be specific. Reference the actual text. Avoid vague praise ("good writing") or vague criticism ("needs work"). A truthful 68 with actionable feedback helps more than a flattering 85 with generic praise.`;

  if (revisionContext) {
    systemPrompt += `\n\n=== REVISION CONTEXT ===

This is revision round ${revisionContext.roundNumber}. Previous score: ${revisionContext.previousFeedback.overallScore}/100.

Previous areas for improvement:
${revisionContext.previousFeedback.improvements.map((imp, i) => `${i + 1}. ${imp}`).join("\n")}

When evaluating this revision:
- Note which areas above the writer addressed and how effectively
- Note areas NOT addressed or that got worse
- Identify NEW issues that emerged
- Score on absolute merits using the same rubric — not on a curve. If the piece genuinely improved from 62 to 71, score 71. If barely changed, score similarly.
- In detailedNotes, open with a direct assessment of the revision effort`;
  }

  systemPrompt += `\nReturn ONLY the JSON object, no other text.`;

  const userMessage = `Prompt: "${prompt}"\n\nWriter's response:\n\n${response}`;

  return { systemPrompt, userMessage };
}

export function sceneExtractionPrompt(chapterText: string) {
  const systemPrompt = `You are an expert fiction editor. The user has written a full chapter as continuous prose. Your job is to split it into logical scenes.

A scene is a continuous unit of action in one time and place. Scene breaks typically occur when:
- The setting changes (new location or significant time jump)
- The point-of-view character changes
- There is a deliberate narrative pause or transition
- The emotional tone shifts dramatically

Return a JSON array of scene objects. Each object must have:
- title: a short descriptive title for the scene (3-8 words)
- content: the EXACT text of that scene, preserving every word, paragraph, and line break from the original

CRITICAL: The concatenation of all scene "content" fields must reproduce the ENTIRE original text with nothing added or removed. Do not rewrite, summarize, or alter the text in any way. Simply split it at natural scene boundaries.

If the text is very short or has no clear scene breaks, return a single scene containing the full text.

Return ONLY the JSON array, no other text.`;

  const userMessage = `Split this chapter into scenes:\n\n${chapterText}`;

  return { systemPrompt, userMessage };
}

export function formatPromptForCopy(
  type: "suggestion" | "consistency" | "prompt_generation" | "grading" | "scene_extraction",
  systemPrompt: string,
  userMessage: string,
): string {
  const labels: Record<string, string> = {
    suggestion: "Writing Analysis",
    consistency: "Consistency Check",
    prompt_generation: "Generate Writing Prompt",
    grading: "Grade Writing Exercise",
    scene_extraction: "Extract Scenes from Chapter",
  };

  return `--- ${labels[type]} ---

INSTRUCTIONS:
${systemPrompt}

---

${userMessage}`;
}
