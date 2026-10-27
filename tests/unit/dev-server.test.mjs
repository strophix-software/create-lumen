import test from "node:test";
import assert from "node:assert/strict";
import { handleDevServer } from "../../src/utils/dev-server.js";

test("handleDevServer: non-interactive mode skips select and prints next steps", async () => {
  // Should resolve immediately without waiting on stdin or hanging
  let called = false;
  const consoleLog = console.log;
  console.log = (msg) => {
    if (String(msg).includes("Next steps")) called = true;
  };

  try {
    await handleDevServer("npm", "test-project", { isNonInteractive: true });
    assert.equal(called, true, "printNextSteps must be called in non-interactive mode");
  } finally {
    console.log = consoleLog;
  }
});

test("handleDevServer: CI environment skips select", async () => {
  const origCI = process.env.CI;
  process.env.CI = "true";
  let called = false;
  const consoleLog = console.log;
  console.log = (msg) => {
    if (String(msg).includes("Next steps")) called = true;
  };

  try {
    await handleDevServer("npm", "test-project", { isNonInteractive: false });
    assert.equal(called, true, "printNextSteps must be called in CI environment");
  } finally {
    process.env.CI = origCI;
    console.log = consoleLog;
  }
});
