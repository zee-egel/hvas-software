// normalize-products.mjs

import fs from "fs/promises";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const INPUT_FILE = "./hvas-invoices.csv";
const OUTPUT_FILE = "./hvas-products-normalized.csv";

async function parseCSV(content) {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");

  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index]]),
    );
  });
}

function slugify(value) {
  if (value === null || value === undefined) {
    return "unknown_product";
  }

  if (typeof value !== "string") {
    value = String(value);
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

async function normalizeBatch(products) {
  const prompt = `
You are a horeca inventory normalization engine.

Goal:
Normalize supplier invoice product names into stable canonical product names.

Rules:
- Products that are clearly the same should get the same canonical_name.
- Preserve meaningful differences:
  - flavor
  - size
  - volume
  - brand
  - packaging
- Keep names concise and readable.
- Use English-like snake_case naming.
- DO NOT invent products.
- Return JSON only.
- Return an array in the same order.

Example:
[
  {
    "original": "LIPTON ICE TEA PEACH 24 X 0.33",
    "canonical_name": "lipton_ice_tea_peach_24x33cl"
  }
]

Products:
${JSON.stringify(products, null, 2)}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4.1",
    temperature: 0,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content:
          "You normalize horeca invoice product names into stable product identifiers.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices[0].message.content;

  const parsed = JSON.parse(content);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed.products)) {
    return parsed.products;
  }

  if (Array.isArray(parsed.items)) {
    return parsed.items;
  }

  console.log("Unexpected GPT response:");
  console.dir(parsed, { depth: null });

  return [];
}

async function main() {
  const csv = await fs.readFile(INPUT_FILE, "utf8");

  const rows = await parseCSV(csv);

  const productMap = new Map();

  for (const row of rows) {
    const raw = row.product_name || row.description || row.product || row.name;

    if (!raw) continue;

    productMap.set(raw.trim(), true);
  }

  const uniqueProducts = [...productMap.keys()];

  console.log(`Found ${uniqueProducts.length} unique products`);

  const batchSize = 40;

  const normalized = [];

  for (let i = 0; i < uniqueProducts.length; i += batchSize) {
    const batch = uniqueProducts.slice(i, i + batchSize);

    console.log(
      `Normalizing batch ${i / batchSize + 1} (${batch.length} products)`,
    );

    const result = await normalizeBatch(batch);

    if (Array.isArray(result)) {
      normalized.push(...result);
    } else {
      console.log("Skipped invalid normalization batch");
    }
  }

  const normalizationMap = new Map();

  for (const item of normalized) {
    const original = item?.original || "unknown_product";

    const canonical =
      typeof item?.canonical_name === "string"
        ? item.canonical_name
        : slugify(original);

    normalizationMap.set(original, canonical);
  }

  const enrichedRows = rows.map((row) => {
    const raw = row.product_name || row.description || row.product || row.name;

    const canonical =
      normalizationMap.get(raw) || slugify(raw || "unknown_product");

    return {
      ...row,
      canonical_product_name: canonical,
      product_id: slugify(canonical),
    };
  });

  const headers = Object.keys(enrichedRows[0]);

  const output = [
    headers.join(","),
    ...enrichedRows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ].join("\n");

  await fs.writeFile(OUTPUT_FILE, output);

  console.log(`Done.`);
  console.log(`Saved to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
