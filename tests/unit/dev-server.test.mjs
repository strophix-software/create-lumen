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

test("handleDevServer: interactive mode invokes execa with cwd set to target directory", async () => {
  const origCI = process.env.CI;
  delete process.env.CI;
  let execaArgs = null;

  try {
    await handleDevServer("npm", "/tmp/sample-project", {
      isNonInteractive: false,
      projectName: "sample-project",
      isTTY: true,
      selectFn: async () => true,
      execaFn: async (pkg, args, opts) => {
        execaArgs = { pkg, args, opts };
      },
    });

    assert.ok(execaArgs, "execaFn must be called");
    assert.equal(execaArgs.pkg, "npm");
    assert.deepEqual(execaArgs.args, ["run", "dev"]);
    assert.equal(execaArgs.opts.cwd, "/tmp/sample-project");
    assert.equal(execaArgs.opts.stdio, "inherit");
  } finally {
    if (origCI !== undefined) process.env.CI = origCI;
  }
});

test("handleDevServer: handles SIGINT / user cancellation gracefully", async () => {
  const origCI = process.env.CI;
  delete process.env.CI;

  try {
    await handleDevServer("npm", "/tmp/sample-project", {
      isNonInteractive: false,
      isTTY: true,
      selectFn: async () => true,
      execaFn: async () => {
        const err = new Error("Command failed");
        err.signal = "SIGINT";
        throw err;
      },
    });
    // Should resolve without throwing
    assert.ok(true, "must not throw on SIGINT");
  } finally {
    if (origCI !== undefined) process.env.CI = origCI;
  }
});
