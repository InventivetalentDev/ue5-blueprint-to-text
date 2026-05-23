"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parse } from "@/lib/parser/graph";
import { detectDefinitionInfo } from "@/lib/parser/detect";
import { renderMarkdown } from "@/lib/render/markdown";
import { renderJson, renderYaml } from "@/lib/render/structured";
import type { GraphKind, MacroFunctionDefinition } from "@/lib/parser/types";
import { EXAMPLES } from "./examples";
import {
  clearAll,
  formatRelative,
  loadDraft,
  loadHistory,
  pushHistory,
  saveDraft,
  type HistoryEntry,
} from "@/lib/storage";

type Format = "markdown" | "yaml" | "json";
type KindChoice = "auto" | GraphKind;

interface DefinitionCard {
  id: number;
  name: string;
  kind: "macro" | "function";
  body: string;
}

let nextCardId = 1;
const newCard = (): DefinitionCard => ({
  id: nextCardId++,
  name: "",
  kind: "macro",
  body: "",
});

export default function Page() {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<Format>("markdown");
  const [kindChoice, setKindChoice] = useState<KindChoice>("auto");
  const [cards, setCards] = useState<DefinitionCard[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    setInput(loadDraft());
    setHistory(loadHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => saveDraft(input), 500);
    return () => clearTimeout(t);
  }, [input, hydrated]);

  const result = useMemo(() => {
    if (!input.trim())
      return { output: "", warnings: [] as string[], error: null as string | null };
    try {
      const override =
        kindChoice === "auto" ? undefined : (kindChoice as GraphKind);
      const graph = parse(input, override);
      const definitions: MacroFunctionDefinition[] = cards
        .filter((c) => c.name.trim() && c.body.trim())
        .map((c) => ({
          name: c.name.trim(),
          kind: c.kind,
          graph: parse(c.body, "blueprint"),
        }));
      let output: string;
      if (format === "markdown") output = renderMarkdown(graph, definitions);
      else if (format === "yaml") output = renderYaml(graph, definitions);
      else output = renderJson(graph, definitions);
      return {
        output,
        warnings: graph.warnings,
        error: null,
        kind: graph.kind,
      };
    } catch (e) {
      return {
        output: "",
        warnings: [] as string[],
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [input, format, kindChoice, cards]);

  const copy = async () => {
    if (!result.output) return;
    await navigator.clipboard.writeText(result.output);
  };

  const snapshot = (prev: string) => {
    if (!prev.trim()) return;
    setHistory(pushHistory(prev));
  };

  const loadExample = (idx: number) => {
    if (idx < 0 || idx >= EXAMPLES.length) return;
    snapshot(inputRef.current);
    setInput(EXAMPLES[idx].value);
  };

  const restoreFromHistory = (id: string) => {
    const entry = history.find((h) => h.id === id);
    if (!entry) return;
    snapshot(inputRef.current);
    setInput(entry.value);
  };

  const handleClear = () => {
    if (!input && history.length === 0) return;
    if (!window.confirm("Clear saved draft and history?")) return;
    clearAll();
    setHistory([]);
    setInput("");
  };

  const addCard = () => setCards((cs) => [...cs, newCard()]);
  const removeCard = (id: number) =>
    setCards((cs) => cs.filter((c) => c.id !== id));
  const updateCard = (id: number, patch: Partial<DefinitionCard>) =>
    setCards((cs) =>
      cs.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        // If the body just changed and the name is still blank, try to pick
        // a name and kind out of the paste so the user doesn't have to.
        if (patch.body !== undefined && !c.name.trim()) {
          const info = detectDefinitionInfo(patch.body);
          if (info.name) {
            next.name = info.name;
            if (info.kind) next.kind = info.kind;
          }
        }
        return next;
      }),
    );

  return (
    <>
      <header className="app-header">
        <h1>UE5 Blueprint → Text</h1>
        <span className="tagline">
          Paste copied nodes (Ctrl+C in UE) → LLM-friendly text
        </span>
        <div className="controls">
          <label>
            Example
            <select
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (v !== "") loadExample(parseInt(v, 10));
                e.target.value = "";
              }}
            >
              <option value="">Load example…</option>
              {EXAMPLES.map((ex, i) => (
                <option key={i} value={i}>
                  {ex.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            History
            <select
              defaultValue=""
              disabled={history.length === 0}
              onChange={(e) => {
                const v = e.target.value;
                if (v !== "") restoreFromHistory(v);
                e.target.value = "";
              }}
            >
              <option value="">
                {history.length === 0 ? "No history" : "Restore…"}
              </option>
              {history.map((h) => (
                <option key={h.id} value={h.id}>
                  {formatRelative(h.savedAt)} — {h.preview}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kind
            <select
              value={kindChoice}
              onChange={(e) => setKindChoice(e.target.value as KindChoice)}
            >
              <option value="auto">Auto</option>
              <option value="blueprint">Blueprint</option>
              <option value="material">Material</option>
            </select>
          </label>
          <label>
            Format
            <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              <option value="markdown">Markdown</option>
              <option value="yaml">YAML</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <button onClick={copy} disabled={!result.output}>
            Copy output
          </button>
          <button
            className="danger"
            onClick={handleClear}
            disabled={!input && history.length === 0}
            title="Clear saved draft and history"
          >
            Clear
          </button>
        </div>
      </header>
      <main className="split">
        <section className="pane">
          <div className="pane-header">
            <span>Input (T3D from UE clipboard)</span>
            <span>{input.length.toLocaleString()} chars</span>
          </div>
          <div className="pane-body">
            <textarea
              className="input"
              spellCheck={false}
              placeholder={
                "Select nodes in the Blueprint or Material editor, press Ctrl+C, paste here."
              }
              value={input}
              onPaste={() => snapshot(inputRef.current)}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <div className="definitions">
            <div className="definitions-header">
              <span>Macro / function bodies</span>
              <button onClick={addCard}>+ Add</button>
            </div>
            {cards.length === 0 && (
              <div className="definitions-empty">
                Optional. Paste the body of a custom macro or function and label
                it with the macro/function name to include it in the output.
              </div>
            )}
            {cards.map((card) => (
              <div key={card.id} className="definition-card">
                <div className="definition-card-row">
                  <input
                    className="definition-name"
                    type="text"
                    placeholder="MacroName"
                    value={card.name}
                    onChange={(e) => updateCard(card.id, { name: e.target.value })}
                  />
                  <select
                    value={card.kind}
                    onChange={(e) =>
                      updateCard(card.id, {
                        kind: e.target.value as "macro" | "function",
                      })
                    }
                  >
                    <option value="macro">Macro</option>
                    <option value="function">Function</option>
                  </select>
                  <button
                    className="definition-remove"
                    onClick={() => removeCard(card.id)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
                <textarea
                  className="definition-body"
                  spellCheck={false}
                  placeholder="Paste the macro/function graph here (Ctrl+C from inside it)…"
                  value={card.body}
                  onChange={(e) => updateCard(card.id, { body: e.target.value })}
                />
              </div>
            ))}
          </div>
        </section>
        <section className="pane">
          <div className="pane-header">
            <span>
              Output
              {result.kind ? ` — detected kind: ${result.kind}` : ""}
            </span>
            <span>{result.output.length.toLocaleString()} chars</span>
          </div>
          {result.error && <div className="error">{result.error}</div>}
          {result.warnings.length > 0 && (
            <div className="warnings">
              Warnings:
              <ul>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="pane-body">
            <pre className="output">{result.output}</pre>
          </div>
        </section>
      </main>
      <footer className="app-footer">
        Runs entirely in your browser. Source:{" "}
        <a
          href="https://github.com/InventivetalentDev/ue5-blueprint-to-text"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/InventivetalentDev/ue5-blueprint-to-text
        </a>
      </footer>
    </>
  );
}
