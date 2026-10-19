import test from "node:test";
import assert from "node:assert/strict";
import { verifyAdminCredential } from "../src/lib/admin-credential.ts";
import { getSavedCode, getSavedPin, saveCode } from "../src/lib/notify/client.ts";

test("private tools use the signed-in session instead of a stale saved PIN", () => {
  const storage = new Map([
    ["ma2-admin-session-v2", "ma2s_example-valid-session"],
    ["ma2-avisos-code-v1", "old-invalid-pin"],
  ]);
  globalThis.window = { localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } };
  assert.equal(getSavedCode(), "ma2s_example-valid-session");
  assert.equal(getSavedPin(), "old-invalid-pin");
  saveCode("ma2s_example-valid-session");
  assert.equal(storage.get("ma2-avisos-code-v1"), "old-invalid-pin");
  storage.delete("ma2-admin-session-v2");
  assert.equal(getSavedCode(), "old-invalid-pin");
  delete globalThis.window;
});

test("an active session authorizes without comparing its token to the password hash", async () => {
  let passwordCalls = 0;
  const result = await verifyAdminCredential("ma2s_test-session", {
    session: async (token) => { assert.equal(token, "ma2s_test-session"); return "authorized"; },
    password: async () => { passwordCalls++; throw new Error("wrong path"); },
  });
  assert.equal(result, "authorized");
  assert.equal(passwordCalls, 0);
});

for (const reason of ["expired", "revoked", "unknown session"]) {
  test(`${reason} cannot fall back to a saved password`, async () => {
    let passwordCalls = 0;
    await assert.rejects(verifyAdminCredential("ma2s_test-session", {
      session: async () => { throw new Error(reason); },
      password: async () => { passwordCalls++; return "authorized"; },
    }), new RegExp(reason));
    assert.equal(passwordCalls, 0);
  });
}

test("legacy PINs still require password validation", async () => {
  await assert.rejects(verifyAdminCredential("incorrect-pin", {
    session: async () => { throw new Error("wrong path"); },
    password: async () => { throw new Error("Código incorrecto"); },
  }), /Código incorrecto/);
});

test("missing credentials never authorize", async () => {
  const authorize = async () => { throw new Error("must not run"); };
  await assert.rejects(verifyAdminCredential("", { session: authorize, password: authorize }), /Inicia sesión/);
});

test("server rendering has no browser credential", () => {
  assert.equal(getSavedCode(), "");
  assert.equal(getSavedPin(), "");
});
