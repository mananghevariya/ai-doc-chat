// Offline tests for lib/rag.ts: no Gemini calls, no DB. Run with:  npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  splitIntoChunks,
  shouldSendWholeDocument,
  buildContext,
  buildPrompt,
  parseSources,
  splitAnswerAndSources,
  getModelOrder,
  generateWithFallback,
  SOURCES_MARKER,
  SMALL_DOC_CHUNKS,
} from "../lib/rag.ts";

// ---------- chunking ----------
test("splitIntoChunks: empty text gives no chunks", () => {
  assert.deepEqual(splitIntoChunks(""), []);
});

test("splitIntoChunks: short text is one trimmed chunk", () => {
  assert.deepEqual(splitIntoChunks("  hello world  "), ["hello world"]);
});

test("splitIntoChunks: chunks never exceed size and overlap by 200", () => {
  const text = "a".repeat(2500);
  const chunks = splitIntoChunks(text, 1000, 200);
  assert.ok(chunks.every((c) => c.length <= 1000));
  assert.equal(chunks.length, 3); // windows start at 0, 800, 1600 (last one reaches the end)
  assert.deepEqual(chunks.map((c) => c.length), [1000, 1000, 900]);
});

test("splitIntoChunks: every character of the source is covered", () => {
  const words = Array.from({ length: 800 }, (_, i) => `w${i}`).join(" ");
  const chunks = splitIntoChunks(words, 1000, 200);
  for (let i = 0; i < 800; i += 37) assert.ok(chunks.some((c) => c.includes(`w${i}`)), `w${i} missing`);
});

test("splitIntoChunks: overlap >= size cannot loop forever", () => {
  const chunks = splitIntoChunks("x".repeat(50), 10, 10);
  assert.ok(chunks.length > 0 && chunks.length <= 50);
  assert.deepEqual(splitIntoChunks("x".repeat(5), 0, 0).length > 0, true);
});

// ---------- retrieval mode ----------
test("shouldSendWholeDocument: boundaries", () => {
  assert.equal(shouldSendWholeDocument(0), false);
  assert.equal(shouldSendWholeDocument(1), true);
  assert.equal(shouldSendWholeDocument(SMALL_DOC_CHUNKS), true);
  assert.equal(shouldSendWholeDocument(SMALL_DOC_CHUNKS + 1), false);
});

// ---------- context + prompt ----------
const rows = [
  { content: "Skills: React, Next.js", pageNumber: 3, similarity: 0.912 },
  { content: "Education: B.Tech IT", pageNumber: 5, similarity: 0.5 },
];

test("buildContext: paragraphs are labelled with the real chunk number, in given order", () => {
  const ctx = buildContext(rows);
  assert.ok(ctx.indexOf("Source Paragraph 3") < ctx.indexOf("Source Paragraph 5"));
  assert.ok(ctx.includes("Relevance: 91.2%"));
  assert.ok(!ctx.includes("Source Paragraph 1,"), "must not renumber 1..N by rank");
});

test("buildPrompt: no context returns just the question", () => {
  assert.equal(buildPrompt("  hi  ", ""), "hi");
});

test("buildPrompt: with context includes rules, marker, context and question", () => {
  const p = buildPrompt("  What skills?  ", buildContext(rows));
  assert.ok(p.includes(SOURCES_MARKER));
  assert.ok(p.includes("I couldn't find that information in the provided document(s)."));
  assert.ok(p.includes("Skills: React, Next.js"));
  assert.ok(p.includes("USER QUESTION: What skills?"));
});

// ---------- source parsing ----------
test("parseSources: plain, fenced, spaced and empty lists", () => {
  assert.deepEqual(parseSources("[1, 2]"), [1, 2]);
  assert.deepEqual(parseSources("```json\n[3]\n```"), [3]);
  assert.deepEqual(parseSources(" [ 4 ,5 ] "), [4, 5]);
  assert.deepEqual(parseSources("[]"), []);
});

test("parseSources: garbage never throws and returns []", () => {
  assert.deepEqual(parseSources(""), []);
  assert.deepEqual(parseSources("none"), []);
  assert.deepEqual(parseSources("[a, b]"), []);
});

test("parseSources: drops duplicates, zero and negatives", () => {
  assert.deepEqual(parseSources("[2, 2, 0, 7]"), [2, 7]);
});

test("splitAnswerAndSources: separates answer from citations", () => {
  const out = splitAnswerAndSources(`React and Next.js.\n${SOURCES_MARKER}\n[3]`);
  assert.equal(out.answer, "React and Next.js.");
  assert.deepEqual(out.sources, [3]);
});

test("splitAnswerAndSources: no marker means whole text is the answer", () => {
  const out = splitAnswerAndSources("Just an answer");
  assert.equal(out.answer, "Just an answer");
  assert.deepEqual(out.sources, []);
});

test("citation round trip: cited number maps to the right chunk of the document", () => {
  const docChunks = ["c1", "c2", "c3 skills", "c4", "c5 education"];
  // retrieval returned chunk 3 and 5 only (similarity order), model cites paragraph 3
  const ctx = buildContext([
    { content: docChunks[2], pageNumber: 3, similarity: 0.9 },
    { content: docChunks[4], pageNumber: 5, similarity: 0.4 },
  ]);
  assert.ok(ctx.includes("Source Paragraph 3"));
  const { sources } = splitAnswerAndSources(`ok\n${SOURCES_MARKER}\n[3]`);
  assert.equal(docChunks[sources[0] - 1], "c3 skills"); // same lookup SourceBadge does
});

// ---------- model fallback ----------
test("getModelOrder: requested first, no duplicates, retired models excluded", () => {
  const order = getModelOrder("gemini-3.7-flash");
  assert.equal(order[0], "gemini-3.7-flash");
  assert.equal(new Set(order).size, order.length);
  assert.ok(!order.includes("gemini-2.5-flash"));
  assert.ok(!order.includes("gemini-pro-latest"));
  assert.ok(order.includes("gemini-3.1-flash-lite"));
});

test("getModelOrder: defaults when nothing requested", () => {
  assert.equal(getModelOrder(undefined)[0], "gemini-3.8-flash");
  assert.equal(getModelOrder(null)[0], "gemini-3.8-flash");
});

test("generateWithFallback: first model OK is returned without trying others", async () => {
  const tried = [];
  const r = await generateWithFallback(["a", "b"], async (m) => (tried.push(m), "ok-" + m), 100);
  assert.deepEqual(r, { result: "ok-a", model: "a" });
  assert.deepEqual(tried, ["a"]);
});

test("generateWithFallback: a 503 falls through to the next model", async () => {
  const errors = [];
  const r = await generateWithFallback(
    ["a", "b"],
    async (m) => {
      if (m === "a") throw new Error("503 Service Unavailable");
      return "ok-b";
    },
    100,
    (m, e) => errors.push([m, e.message])
  );
  assert.equal(r.model, "b");
  assert.deepEqual(errors, [["a", "503 Service Unavailable"]]);
});

test("generateWithFallback: a hanging model is timed out and skipped", async () => {
  const t0 = Date.now();
  const r = await generateWithFallback(
    ["slow", "fast"],
    (m) => (m === "slow" ? new Promise(() => {}) : Promise.resolve("done")),
    50
  );
  assert.equal(r.model, "fast");
  assert.ok(Date.now() - t0 < 1000);
});

test("generateWithFallback: returns null when every model fails", async () => {
  const r = await generateWithFallback(["a", "b"], async () => { throw new Error("boom"); }, 50);
  assert.equal(r, null);
});
