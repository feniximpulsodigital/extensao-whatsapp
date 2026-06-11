// Valida a sintaxe dos templates JS gerados pelo extension-builder.
// Extrai cada template literal, des-escapa e roda new Function() para checar sintaxe.
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/lib/extension-builder.functions.ts", import.meta.url), "utf8");

function extractTemplate(constName) {
  const start = src.indexOf(`const ${constName} = \``);
  if (start === -1) throw new Error(`${constName} não encontrado`);
  let i = start + `const ${constName} = \``.length;
  let out = "";
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      // sequência de escape do template literal do TS: \\ \` \$
      out += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === "`") break;
    if (ch === "$" && src[i + 1] === "{") throw new Error(`${constName} contém interpolação \${} — não suportado por este check`);
    out += ch;
    i++;
  }
  return out;
}

let failed = false;
for (const name of ["CONTENT_JS", "BRIDGE_JS", "BACKGROUND_JS", "POPUP_JS"]) {
  try {
    const code = extractTemplate(name);
    new Function(code); // compila sem executar — só valida sintaxe
    console.log(`OK  ${name} (${code.length} chars)`);
  } catch (e) {
    failed = true;
    console.error(`ERRO ${name}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
