import assert from "node:assert/strict";
import { mock, test } from "node:test";

let resolvePopup: (value: unknown) => void;
let rejectPopup: (reason: unknown) => void;
const popup = mock.fn(() => new Promise((resolve, reject) => {
  resolvePopup = resolve;
  rejectPopup = reject;
}));

mock.module("firebase/auth", {
  namedExports: { GoogleAuthProvider: class {}, signInWithPopup: popup },
});

const { signInWithGoogle } = await import("../src/auth/googleSignIn.ts");

test("Google sign-in preserves the initiating tab and handles retries", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalPopState = Object.getOwnPropertyDescriptor(globalThis, "PopStateEvent");
  const panel = "https://andrwlab.github.io/Season2App/pilot/t?view=matches#add";
  const historyState = { key: "panel", idx: 1 };
  const sourceTab = {
    location: { href: panel },
    history: { state: historyState, replaceState: mock.fn() },
    dispatchEvent: mock.fn(),
    focus: mock.fn(),
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: sourceTab });
  Object.defineProperty(globalThis, "PopStateEvent", {
    configurable: true, value: class { constructor(public type: string) {} },
  });
  try {
    const auth = {} as Parameters<typeof signInWithGoogle>[0];
    const credential = { user: { uid: "scorekeeper" } };

    const first = signInWithGoogle(auth);
    assert.equal(signInWithGoogle(auth), first, "double taps reuse the pending popup");
    assert.equal(popup.mock.callCount(), 1);
    resolvePopup(credential);
    assert.equal(await first, credential);
    assert.equal(sourceTab.history.replaceState.mock.callCount(), 0, "normal success leaves the route unchanged");
    assert.equal(sourceTab.focus.mock.callCount(), 1);

    const next = signInWithGoogle(auth);
    sourceTab.location.href = "https://andrwlab.github.io/Season2App/live/t";
    resolvePopup(credential);
    await next;
    assert.deepEqual(sourceTab.history.replaceState.mock.calls[0].arguments, [historyState, "", panel]);
    assert.equal(sourceTab.dispatchEvent.mock.calls[0].arguments[0].type, "popstate");

    const failed = signInWithGoogle(auth);
    rejectPopup({ code: "auth/popup-blocked" });
    await assert.rejects(failed, { code: "auth/popup-blocked" });
    assert.equal(sourceTab.focus.mock.callCount(), 2, "failed login does not navigate or focus another tab");

    const retry = signInWithGoogle(auth);
    assert.equal(popup.mock.callCount(), 4, "a failed attempt does not lock out retries");
    resolvePopup(credential);
    await retry;
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalPopState) Object.defineProperty(globalThis, "PopStateEvent", originalPopState);
    else Reflect.deleteProperty(globalThis, "PopStateEvent");
  }
});
