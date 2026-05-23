"use client";

import { useMemo, useState } from "react";
import { parse } from "@/lib/parser/graph";
import { renderMarkdown } from "@/lib/render/markdown";
import { renderJson, renderYaml } from "@/lib/render/structured";
import type { GraphKind } from "@/lib/parser/types";
import { EXAMPLES } from "./examples";

type Format = "markdown" | "yaml" | "json";
type KindChoice = "auto" | GraphKind;

export default function Page() {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<Format>("markdown");
  const [kindChoice, setKindChoice] = useState<KindChoice>("auto");

  const result = useMemo(() => {
    if (!input.trim()) return { output: "", warnings: [] as string[], error: null as string | null };
    try {
      const override =
        kindChoice === "auto" ? undefined : (kindChoice as GraphKind);
      const graph = parse(input, override);
      let output: string;
      if (format === "markdown") output = renderMarkdown(graph);
      else if (format === "yaml") output = renderYaml(graph);
      else output = renderJson(graph);
      return { output, warnings: graph.warnings, error: null, kind: graph.kind };
    } catch (e) {
      return {
        output: "",
        warnings: [] as string[],
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }, [input, format, kindChoice]);

  const copy = async () => {
    if (!result.output) return;
    await navigator.clipboard.writeText(result.output);
  };

  const loadExample = (idx: number) => {
    if (idx < 0 || idx >= EXAMPLES.length) return;
    setInput(EXAMPLES[idx].value);
  };

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
              onChange={(e) => setInput(e.target.value)}
            />
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
