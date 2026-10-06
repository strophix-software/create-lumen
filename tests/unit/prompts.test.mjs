import test from "node:test";
import assert from "node:assert/strict";
import { BACK, CANCEL, formatConfig, runPromptFlow, getUserInputs } from "../../src/prompts.js";
import * as configCache from "../../src/config-cache.js";

test("prompts: formatConfig displays human-friendly architecture names", () => {
  assert.match(formatConfig({ architecture: "feature-based", language: "ts" }), /Feature-based/);
  assert.match(formatConfig({ architecture: "type-based", language: "ts" }), /Type-based/);
  assert.match(formatConfig({ architecture: "none", language: "ts" }), /None/);
  assert.match(formatConfig({ architecture: "hybrid", language: "ts" }), /Hybrid/);
});

test("prompts: runPromptFlow linear progression collects all answers", async () => {
  const steps = [
    {
      id: "step1",
      message: "Step 1",
      options: [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ],
      defaultInitial: "a",
    },
    {
      id: "step2",
      message: "Step 2",
      options: [
        { label: "Option X", value: "x" },
        { label: "Option Y", value: "y" },
      ],
      defaultInitial: "x",
    },
  ];

  const answers = await runPromptFlow({
    steps,
    selectFn: async ({ message }) => {
      if (message === "Step 1") return "b";
      if (message === "Step 2") return "y";
      throw new Error(`Unexpected message: ${message}`);
    },
  });

  assert.deepEqual(answers, {
    step1: "b",
    step2: "y",
  });
});

test("prompts: runPromptFlow back navigation rewinds to previous question with preselected value", async () => {
  const promptLog = [];

  const steps = [
    {
      id: "step1",
      message: "Step 1",
      options: [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ],
      defaultInitial: "a",
    },
    {
      id: "step2",
      message: "Step 2",
      options: [
        { label: "Option X", value: "x" },
        { label: "Option Y", value: "y" },
      ],
      defaultInitial: "x",
    },
  ];

  let visitCount = 0;
  const answers = await runPromptFlow({
    steps,
    selectFn: async ({ message, options, initialValue }) => {
      promptLog.push({ message, initialValue, hasBack: options.some((o) => o.value === BACK) });
      visitCount++;

      // 1st prompt: Step 1 -> answer 'b'
      if (visitCount === 1) {
        assert.equal(message, "Step 1");
        assert.equal(options.some((o) => o.value === BACK), false); // No back on first step
        return "b";
      }

      // 2nd prompt: Step 2 -> choose Back!
      if (visitCount === 2) {
        assert.equal(message, "Step 2");
        assert.equal(options.some((o) => o.value === BACK), true); // Back option available
        return BACK;
      }

      // 3rd prompt: returned to Step 1 -> verify previous answer 'b' is preselected
      if (visitCount === 3) {
        assert.equal(message, "Step 1");
        assert.equal(initialValue, "b"); // Preselected!
        return "a"; // Change answer to 'a'
      }

      // 4th prompt: back to Step 2 -> answer 'y'
      if (visitCount === 4) {
        assert.equal(message, "Step 2");
        return "y";
      }

      throw new Error(`Unexpected visit ${visitCount}`);
    },
  });

  assert.equal(answers.step1, "a");
  assert.equal(answers.step2, "y");
});

test("prompts: runPromptFlow multi-step back navigation", async () => {
  const steps = [
    { id: "s1", message: "S1", options: [{ value: 1, label: "1" }], defaultInitial: 1 },
    { id: "s2", message: "S2", options: [{ value: 2, label: "2" }], defaultInitial: 2 },
    { id: "s3", message: "S3", options: [{ value: 3, label: "3" }], defaultInitial: 3 },
  ];

  let call = 0;
  const answers = await runPromptFlow({
    steps,
    selectFn: async ({ message }) => {
      call++;
      if (call === 1) return 1; // S1 -> 1
      if (call === 2) return 2; // S2 -> 2
      if (call === 3) return BACK; // S3 -> BACK (to S2)
      if (call === 4) return BACK; // S2 -> BACK (to S1)
      if (call === 5) return 10; // S1 -> 10
      if (call === 6) return 20; // S2 -> 20
      if (call === 7) return 30; // S3 -> 30
      throw new Error("Out of bounds");
    },
  });

  assert.deepEqual(answers, { s1: 10, s2: 20, s3: 30 });
});

test("prompts: runPromptFlow clean cancel via isCancel/onCancelFn", async () => {
  let cancelled = false;
  const steps = [
    { id: "s1", message: "S1", options: [{ value: 1, label: "1" }], defaultInitial: 1 },
  ];

  const answers = await runPromptFlow({
    steps,
    selectFn: async () => CANCEL,
    onCancelFn: () => {
      cancelled = true;
    },
  });

  assert.equal(cancelled, true);
  assert.equal(answers, null);
});

test("prompts: getUserInputs does not save config cache until final confirm", async () => {
  let saveConfigCalled = false;
  let confirmShown = false;

  const result = await getUserInputs("test-backnav-app", {
    quickSetup: false,
    configExistsFn: async () => false,
    saveConfigFn: async () => {
      saveConfigCalled = true;
    },
    selectFn: async ({ message, options }) => {
      // Quick setup prompt -> No (custom setup)
      if (message.includes("Quick Setup?")) return false;
      // Architecture prompt -> none
      if (message.includes("architecture")) return "none";
      // Language -> ts
      if (message.includes("language")) return "ts";
      // CSS -> none
      if (message.includes("CSS")) return "none";
      // Testing -> vitest
      if (message.includes("testing")) return "vitest";
      // Router -> false
      if (message.includes("Router")) return false;
      // State -> none
      if (message.includes("state management")) return "none";
      // Icons -> none
      if (message.includes("icon library")) return "none";
      // API Client -> none
      if (message.includes("API client")) return "none";
      // Git -> false
      if (message.includes("Git repository")) return false;
      // Linter -> none
      if (message.includes("linter")) return "none";
      // Docs -> en
      if (message.includes("docs language")) return "en";
      // Readme -> false
      if (message.includes("README.md")) return false;

      // Final confirm prompt
      if (message.includes("Proceed with project generation?")) {
        confirmShown = true;
        // Verify saveConfig has NOT yet been called!
        assert.equal(saveConfigCalled, false, "saveConfig must NOT be called before final confirm");
        return true; // Confirm
      }

      return options[0].value;
    },
    noteFn: () => {},
  });

  assert.equal(confirmShown, true);
  assert.equal(result.architecture, "none");
  assert.equal(result.projectName, "test-backnav-app");
  assert.equal(saveConfigCalled, true, "saveConfig must be called after final confirm");
});

test("prompts: quickSetup choice allows back navigation from final confirm to edit options", async () => {
  let promptCount = 0;
  const result = await getUserInputs("test-quicksetup-back", {
    quickSetup: false,
    configExistsFn: async () => false,
    saveConfigFn: async () => {},
    selectFn: async ({ message, options }) => {
      promptCount++;
      // First: framework step (new) — stay on React + Vite
      if (promptCount === 1) {
        assert.ok(message.includes("Which framework"));
        return "react:vite";
      }
      // Second: choose Quick Setup (true)
      if (promptCount === 2) {
        assert.ok(message.includes("Quick Setup?"));
        return true;
      }
      // Third: on final confirm, choose BACK!
      if (promptCount === 3) {
        assert.ok(message.includes("Proceed with project generation?"));
        return BACK;
      }
      // Fourth: back at Quick Setup prompt, choose No (false) for custom setup
      if (promptCount === 4) {
        assert.ok(message.includes("Quick Setup?"));
        return false;
      }
      // Fourth: at architecture prompt, choose none
      if (message.includes("architecture")) {
        return "none";
      }
      if (message.includes("Proceed with project generation?")) {
        return true;
      }
      return options[0].value;
    },
    noteFn: () => {},
  });

  assert.equal(result.architecture, "none");
  assert.ok(promptCount >= 4);
});

test("prompts: architecture choices scoped per framework (React vs Next)", async () => {
  let reactArchOptions;
  await getUserInputs("app-react", {
    quickSetup: false,
    framework: "react",
    configExistsFn: async () => false,
    saveConfigFn: async () => {},
    selectFn: async ({ message, options }) => {
      if (message.includes("Quick Setup?")) return false;
      if (message.includes("architecture")) {
        reactArchOptions = options.map((o) => o.value).filter((v) => v !== BACK);
        return "feature-based";
      }
      if (message.includes("Proceed with project generation?")) return true;
      return options[0].value;
    },
    noteFn: () => {},
  });

  assert.deepEqual(reactArchOptions, ["feature-based", "type-based", "none"]);

  let nextArchOptions;
  await getUserInputs("app-next", {
    quickSetup: false,
    framework: "next",
    configExistsFn: async () => false,
    saveConfigFn: async () => {},
    selectFn: async ({ message, options }) => {
      if (message.includes("Quick Setup?")) return false;
      if (message.includes("architecture")) {
        nextArchOptions = options.map((o) => o.value).filter((v) => v !== BACK);
        return "hybrid";
      }
      if (message.includes("Proceed with project generation?")) return true;
      return options[0].value;
    },
    noteFn: () => {},
  });

  assert.deepEqual(nextArchOptions, ["feature-based", "hybrid", "none"]);
});

