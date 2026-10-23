import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const bundle = await build({
  entryPoints: ["tests/ui/fixture.tsx"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  alias: {
    "next/link": path.join(root, "tests/ui/navigation.tsx"),
    "next/navigation": path.join(root, "tests/ui/navigation.tsx"),
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_QA_PROFILE": '"0"',
  },
});
const css = (
  await Promise.all(
    ["design-tokens.css", "globals.css", "workspace.css", "motion.css"].map(
      (file) => readFile(`src/app/${file}`, "utf8"),
    ),
  )
)
  .join("\n")
  .replace(/^@import[^;]+;/gm, "");
const font = await readFile(
  "node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2",
);
const html = `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Barbería OS · QA aislado</title><style>@font-face{font-family:'DM Sans Variable';font-style:normal;font-weight:100 1000;src:url('/font.woff2') format('woff2');font-display:swap}${css}</style></head><body><a class="skip-link" href="#content">Ir al contenido</a><div id="root"></div><script src="/fixture.js"></script></body></html>`;
createServer((request, response) => {
  if (request.url === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(bundle.outputFiles[0].text);
  } else if (request.url === "/font.woff2") {
    response.setHeader("Content-Type", "font/woff2");
    response.end(font);
  } else if (request.url?.startsWith("/api/")) {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Unconfigured isolated fixture" }));
  } else {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(html);
  }
}).listen(3007, "127.0.0.1", () =>
  console.log("Isolated component server: http://127.0.0.1:3007"),
);
