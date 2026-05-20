import hljs from "highlight.js/lib/core";

import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python    from "highlight.js/lib/languages/python";
import bash      from "highlight.js/lib/languages/bash";
import json      from "highlight.js/lib/languages/json";
import xml       from "highlight.js/lib/languages/xml";
import css       from "highlight.js/lib/languages/css";
import markdown  from "highlight.js/lib/languages/markdown";
import yaml      from "highlight.js/lib/languages/yaml";
import plaintext from "highlight.js/lib/languages/plaintext";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js",  javascript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts",  typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py",  python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh",  bash);
hljs.registerLanguage("zsh", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml",  xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("svg",  xml);
hljs.registerLanguage("css",  css);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md",  markdown);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("text", plaintext);

type Loader = () => Promise<{ default: unknown }>;

const LAZY_LOADERS: Record<string, Loader> = {
  shell:      () => import("highlight.js/lib/languages/shell"),
  scss:       () => import("highlight.js/lib/languages/scss"),
  sass:       () => import("highlight.js/lib/languages/scss"),
  sql:        () => import("highlight.js/lib/languages/sql"),
  java:       () => import("highlight.js/lib/languages/java"),
  csharp:     () => import("highlight.js/lib/languages/csharp"),
  cs:         () => import("highlight.js/lib/languages/csharp"),
  cpp:        () => import("highlight.js/lib/languages/cpp"),
  c:          () => import("highlight.js/lib/languages/c"),
  go:         () => import("highlight.js/lib/languages/go"),
  golang:     () => import("highlight.js/lib/languages/go"),
  rust:       () => import("highlight.js/lib/languages/rust"),
  rs:         () => import("highlight.js/lib/languages/rust"),
  ruby:       () => import("highlight.js/lib/languages/ruby"),
  rb:         () => import("highlight.js/lib/languages/ruby"),
  php:        () => import("highlight.js/lib/languages/php"),
  swift:      () => import("highlight.js/lib/languages/swift"),
  kotlin:     () => import("highlight.js/lib/languages/kotlin"),
  kt:         () => import("highlight.js/lib/languages/kotlin"),
  scala:      () => import("highlight.js/lib/languages/scala"),
  r:          () => import("highlight.js/lib/languages/r"),
  perl:       () => import("highlight.js/lib/languages/perl"),
  lua:        () => import("highlight.js/lib/languages/lua"),
  haskell:    () => import("highlight.js/lib/languages/haskell"),
  hs:         () => import("highlight.js/lib/languages/haskell"),
  dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
  docker:     () => import("highlight.js/lib/languages/dockerfile"),
  makefile:   () => import("highlight.js/lib/languages/makefile"),
  diff:       () => import("highlight.js/lib/languages/diff"),
  ini:        () => import("highlight.js/lib/languages/ini"),
  toml:       () => import("highlight.js/lib/languages/ini"),
  graphql:    () => import("highlight.js/lib/languages/graphql"),
  gql:        () => import("highlight.js/lib/languages/graphql"),
  dart:       () => import("highlight.js/lib/languages/dart"),
  elixir:     () => import("highlight.js/lib/languages/elixir"),
  objectivec: () => import("highlight.js/lib/languages/objectivec"),
  objc:       () => import("highlight.js/lib/languages/objectivec"),
};

// Canonical name used for registration (aliases map to the same canonical)
const CANONICAL: Record<string, string> = {
  sass: "scss", cs: "csharp", golang: "go", rs: "rust", rb: "ruby",
  kt: "kotlin", hs: "haskell", docker: "dockerfile", toml: "ini",
  gql: "graphql", objc: "objectivec",
};

const _pending = new Map<string, Promise<void>>();

export async function ensureLanguage(lang: string): Promise<void> {
  const key = lang.toLowerCase();
  const canonical = CANONICAL[key] ?? key;

  if (hljs.getLanguage(canonical) || hljs.getLanguage(key)) return;

  const loader = LAZY_LOADERS[key];
  if (!loader) return;

  const existing = _pending.get(canonical);
  if (existing) return existing;

  const p = loader().then((mod) => {
    const fn = (mod as { default: unknown }).default;
    if (!hljs.getLanguage(canonical)) {
      hljs.registerLanguage(canonical, fn as Parameters<typeof hljs.registerLanguage>[1]);
      if (key !== canonical) hljs.registerLanguage(key, fn as Parameters<typeof hljs.registerLanguage>[1]);
    }
  }).finally(() => {
    _pending.delete(canonical);
  });

  _pending.set(canonical, p);
  return p;
}

export default hljs;
