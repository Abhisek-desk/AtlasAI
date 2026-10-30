// TEMPORARY: run from backend/services/agent, then delete it.
//   node make-test-link.mjs http://localhost:5000
// (use your gateway address). It saves a small PDF and prints links to open in
// the browser. No AI model and no cloud service is involved, so it shows
// whether the download route itself works.
import "dotenv/config";
import { saveFile, createSignedUrl } from "./utils/localFiles.js";

const gateway = (process.argv[2] || "").replace(/\/+$/, "");

if (!gateway) {
  console.error("Give your gateway address, e.g.  node make-test-link.mjs http://localhost:5000");
  process.exit(1);
}

// A tiny but valid PDF (offsets are computed, so viewers don't need to repair it).
const buildPdf = () => {
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 120]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    null,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  const content = "BT /F1 20 Tf 30 55 Td (AtlasAI download works) Tj ET";
  objects[3] = `<</Length ${content.length}>>\nstream\n${content}\nendstream`;

  let pdf = "%PDF-1.4\n";
  const offsets = [];

  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
};

await saveFile("atlas-test.pdf", buildPdf());

// Use the address given on the command line when the .env has none.
process.env.PUBLIC_API_URL ||= gateway;

const absolute = createSignedUrl("atlas-test.pdf", 600);
const direct = `http://localhost:${process.env.PORT}/agent/files/${absolute.split("/api/files/")[1]}`;

console.log("\n1) Through the gateway (what the chat links use). Open this in your browser:\n");
console.log(absolute);
console.log("\n2) Straight to the agent service (skips the gateway):\n");
console.log(direct);
console.log("\nBoth links stop working after 10 minutes.\n");