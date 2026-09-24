// Wuanberri — content generators
// Each generator calls the LLM and returns structured content for the page to render.
// The LLM is asked for STRICT JSON so we can render it deterministically.

(function (global) {
  'use strict';

  // Build a system prompt that pins the model to a strict JSON schema.
  const buildSystem = (role, schema) => `You are the Wuanberri ${role} generator.
You produce structured JSON only — no prose, no markdown fences, no commentary.
The JSON must match this exact shape:
${JSON.stringify(schema, null, 2)}

Rules:
- All math should be written in LaTeX inside $...$ for inline and $$...$$ for display. Use \\frac{}{}, \\int, \\sum, \\sqrt{}, ^, _, etc.
- Difficulty is one of: intro, easy, medium, hard.
- Topic should be short (2-6 words), no preamble.
- If asked for a count, return exactly that many items.
- Never invent things you don't know. If uncertain, leave the field empty.
Return ONLY the JSON.`;

  // Call LLM and parse the JSON reply. If the model wraps it in fences, strip them.
  const callJSON = async (provider, system, userMessage) => {
    const raw = await LLM.send({
      provider,
      system,
      userMessage,
      history: [],
      context: 'Generator',
    });
    let s = raw.trim();
    if (s.startsWith('\`\`\`')) s = s.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\`\`\`\s*$/, '');
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Model did not return JSON.');
    s = s.slice(start, end + 1);
    return JSON.parse(s);
  };

  // Random per-call seed injected into every generation prompt. Without it
  // the model regenerates the same textbook items run after run — users saw
  // the identical quiz twice in a row.
  const variationSeed = () => `Variation seed: ${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}. Vary the scenarios, numbers, names, and contexts — avoid the most common textbook examples.`;

  // ---------- The five generators ----------

  const generateDeck = async ({ topic, count = 8, difficulty = 'medium' }) => {
    const schema = {
      deck: {
        topic: 'string',
        cards: [
          {
            front: 'string (the question or concept)',
            back: 'string (the answer)',
            hint: 'string (optional, one line)',
            explanation: 'string (optional, one paragraph)',
          },
        ],
      },
    };
    return callJSON(
      LLM.activeProvider(),
      buildSystem('flashcard deck', schema),
      `Generate a deck of exactly ${count} flashcards on the topic: "${topic}". Difficulty: ${difficulty}. Mix definitions, formulas, and applied questions. ${variationSeed()}`
    );
  };

  const generateQuickPractice = async ({ topic, count = 5, difficulty = 'medium' }) => {
    const schema = {
      practice: {
        topic: 'string',
        questions: [
          {
            prompt: 'string (the problem)',
            choices: ['A', 'B', 'C', 'D'],
            answerIndex: 0,
            explain: 'string (one paragraph)',
          },
        ],
      },
    };
    return callJSON(
      LLM.activeProvider(),
      buildSystem('quick practice set', schema),
      `Generate exactly ${count} multiple-choice questions on "${topic}". Difficulty: ${difficulty}. Each must have exactly 4 choices and exactly one correct answer (answerIndex 0-3). ${variationSeed()}`
    );
  };

  const generateWorkout = async ({ topic, parts = 3, difficulty = 'medium' }) => {
    const schema = {
      workout: {
        topic: 'string',
        parts: [
          {
            title: 'string',
            problem: 'string (the setup)',
            setup: 'string (the data, given quantities)',
            question: 'string (what to find)',
            answer: 'string (numeric or symbolic)',
            tolerance: 0.1,
            hint: 'string',
            explanation: 'string (one paragraph)',
          },
        ],
      },
    };
    return callJSON(
      LLM.activeProvider(),
      buildSystem('multi-step workout', schema),
      `Generate a multi-step workout of exactly ${parts} parts on "${topic}". Difficulty: ${difficulty}. Each part must be solvable from the previous and have a numeric or short symbolic answer. Tolerance is a small number (e.g. 0.01 to 0.5). ${variationSeed()}`
    );
  };

  const generateStudyPlan = async ({ goal, weeks = 4, hoursPerWeek = 5, level = 'Calc I' }) => {
    const schema = {
      plan: {
        title: 'string',
        weeks: [
          {
            week: 1,
            theme: 'string',
            goals: ['string'],
            dailyTasks: [
              { day: 'Mon', task: 'string', minutes: 30 },
            ],
            milestones: ['string'],
          },
        ],
      },
    };
    return callJSON(
      LLM.activeProvider(),
      buildSystem('study plan', schema),
      `Generate a ${weeks}-week study plan for: "${goal}". Student level: ${level}. Available time: ${hoursPerWeek} hours per week. Each week should have 3-5 daily tasks with realistic minutes. Include 2-3 weekly milestones. ${variationSeed()}`
    );
  };

  const generateWorkedExample = async ({ topic, kind = 'walkthrough' }) => {
    const schema = {
      example: {
        title: 'string',
        topic: 'string',
        setup: 'string (the problem statement)',
        steps: [
          { heading: 'string', body: 'string (with LaTeX math)', math: 'string (optional, the key LaTeX for this step)' },
        ],
        finalAnswer: 'string',
        takeaway: 'string (one sentence)',
      },
    };
    const kindPrompt = {
      walkthrough: 'step-by-step walkthrough of a single problem',
      derivation: 'derivation of a formula or identity',
      proof: 'a short proof of a result',
      explanation: 'conceptual explanation with a worked example',
    }[kind] || 'step-by-step walkthrough';
    return callJSON(
      LLM.activeProvider(),
      buildSystem('worked example', schema),
      `Generate a ${kindPrompt} on the topic: "${topic}". Use LaTeX for math. The steps array should have 3-6 entries. ${variationSeed()}`
    );
  };

  // ---------- Pop quiz (used by the dashboard "Take a pop quiz" button) ----------
  // A short MCQ set tailored to a topic — usually the user's weakest
  // subjects based on Store.getReviews() and Store.getPlacement(). Same
  // shape as generateQuickPractice but tuned for a "quick catch-up"
  // rather than a full practice session.
  const generatePopQuiz = async ({ topics, count = 5, difficulty = 'medium' }) => {
    const schema = {
      quiz: {
        topic: 'string (the overall topic the quiz covers)',
        questions: [
          {
            prompt: 'string (the question — clear and self-contained)',
            choices: ['A', 'B', 'C', 'D'],
            answerIndex: 0,
            explain: 'string (1-2 sentence explanation of the correct answer)',
          },
        ],
      },
    };
    const topicList = (Array.isArray(topics) && topics.length ? topics : ['calculus', 'physics']).join(', ');
    return callJSON(
      LLM.activeProvider(),
      buildSystem('pop quiz', schema),
      `Generate a pop quiz of exactly ${count} multiple-choice questions (4 choices each) covering these subjects: ${topicList}. Mix ${difficulty} difficulty. Each question tests a different concept. The first choice must be the correct answer in at least 2 of the 5 questions so users can't just always click "A". ${variationSeed()} Return STRICT JSON only.`
    );
  };

  // ---------- Public API ----------

  global.Generators = {
    generateDeck,
    generateQuickPractice,
    generateWorkout,
    generateStudyPlan,
    generateWorkedExample,
    generatePopQuiz,
  };
})(window);
