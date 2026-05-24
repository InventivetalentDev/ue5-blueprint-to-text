"use client";

import { useEffect, useMemo, useState } from "react";
import { parse } from "@/lib/parser/graph";
import { detectDefinitionInfo } from "@/lib/parser/detect";
import { renderMarkdown } from "@/lib/render/markdown";
import { renderJson, renderYaml } from "@/lib/render/structured";
import type { GraphKind, MacroFunctionDefinition } from "@/lib/parser/types";
import { EXAMPLES } from "./examples";
import {
  clearDraft,
  deleteGraph,
  findByName,
  formatRelative,
  loadDraft,
  loadDraftCards,
  loadSaved,
  renameGraph,
  saveDraft,
  saveDraftCards,
  suggestName,
  upsertGraph,
  type SavedCard,
  type SavedGraph,
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

const cardsFromSaved = (cards: SavedCard[]): DefinitionCard[] =>
  cards.map((c) => ({
    id: nextCardId++,
    name: c.name,
    kind: c.kind,
    body: c.body,
  }));

const cardsToSaved = (cards: DefinitionCard[]): SavedCard[] =>
  cards.map((c) => ({ name: c.name, kind: c.kind, body: c.body }));

export default function Page() {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<Format>("markdown");
  const [kindChoice, setKindChoice] = useState<KindChoice>("auto");
  const [cards, setCards] = useState<DefinitionCard[]>([]);
  const [saved, setSaved] = useState<SavedGraph[]>([]);
  const [currentSaveId, setCurrentSaveId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setInput(loadDraft());
    setCards(cardsFromSaved(loadDraftCards()));
    setSaved(loadSaved());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => saveDraft(input), 500);
    return () => clearTimeout(t);
  }, [input, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => saveDraftCards(cardsToSaved(cards)), 500);
    return () => clearTimeout(t);
  }, [cards, hydrated]);

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
      const rendered =
        format === "markdown"
          ? renderMarkdown(graph, definitions)
          : format === "yaml"
            ? renderYaml(graph, definitions)
            : renderJson(graph, definitions);
      return {
        output: rendered.output,
        warnings: rendered.warnings,
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

  const loadExample = (idx: number) => {
    if (idx < 0 || idx >= EXAMPLES.length) return;
    setInput(EXAMPLES[idx].value);
    setCards([]);
    setCurrentSaveId(null);
  };

  const loadFromSaved = (id: string) => {
    const entry = saved.find((s) => s.id === id);
    if (!entry) return;
    setInput(entry.value);
    setCards(cardsFromSaved(entry.cards));
    setCurrentSaveId(entry.id);
  };

  const current = currentSaveId ? saved.find((s) => s.id === currentSaveId) : null;

  const handleSave = () => {
    if (!input.trim()) return;
    const defaultName = current?.name ?? suggestName(saved);
    const name = window.prompt("Name for this graph:", defaultName);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const snapshot = cardsToSaved(cards);
    const clash = findByName(saved, trimmed);
    if (clash && clash.id !== currentSaveId) {
      if (!window.confirm(`Overwrite existing "${trimmed}"?`)) return;
      const result = upsertGraph(clash.id, trimmed, input, snapshot);
      setSaved(result.entries);
      setCurrentSaveId(result.saved.id);
      return;
    }
    const result = upsertGraph(currentSaveId, trimmed, input, snapshot);
    setSaved(result.entries);
    setCurrentSaveId(result.saved.id);
  };

  const handleRename = () => {
    if (!current) return;
    const name = window.prompt("New name:", current.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === current.name) return;
    const clash = findByName(saved, trimmed);
    if (clash && clash.id !== current.id) {
      window.alert(`A graph named "${trimmed}" already exists.`);
      return;
    }
    setSaved(renameGraph(current.id, trimmed));
  };

  const handleDelete = () => {
    if (!current) return;
    if (!window.confirm(`Delete "${current.name}"?`)) return;
    setSaved(deleteGraph(current.id));
    setCurrentSaveId(null);
  };

  const handleClear = () => {
    if (!input && cards.length === 0) return;
    if (!window.confirm("Clear current input? Saved graphs will be kept.")) return;
    clearDraft();
    setInput("");
    setCards([]);
    setCurrentSaveId(null);
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
            Saved
            <select
              value={currentSaveId ?? ""}
              disabled={saved.length === 0}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") setCurrentSaveId(null);
                else loadFromSaved(v);
              }}
            >
              <option value="">
                {saved.length === 0 ? "No saved graphs" : "— New —"}
              </option>
              {saved.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatRelative(s.updatedAt)})
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
            onClick={handleSave}
            disabled={!input.trim()}
            title={current ? `Save (currently editing "${current.name}")` : "Save graph"}
          >
            {current ? "Save" : "Save as…"}
          </button>
          <button
            onClick={handleRename}
            disabled={!current}
            title="Rename loaded graph"
          >
            Rename
          </button>
          <button
            className="danger"
            onClick={handleDelete}
            disabled={!current}
            title="Delete loaded graph"
          >
            Delete
          </button>
          <button
            className="danger"
            onClick={handleClear}
            disabled={!input && cards.length === 0}
            title="Clear current input and macro/function cards"
          >
            Clear
          </button>
        </div>
      </header>
      <main className="split">
        <section className="pane">
          <div className="pane-header">
            <span>
              Input (T3D from UE clipboard)
              {current ? ` — ${current.name}` : ""}
            </span>
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
