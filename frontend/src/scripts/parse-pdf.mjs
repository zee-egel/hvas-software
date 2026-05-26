import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import { stringify } from "csv-stringify/sync";
import { z } from "zod";

const client = new OpenAI({
  apiKey: "sk-proj-wat-denk-je-zelf",
});

const InvoiceSchema = z.object({
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  supplier: z.object({
    name: z.string().nullable(),
    kvk: z.string().nullable(),
    vatNumber: z.string().nullable(),
    iban: z.string().nullable(),
  }),
  customer: z.object({
    name: z.string().nullable(),
    city: z.string().nullable(),
    debtorNumber: z.string().nullable(),
  }),
  lines: z.array(
    z.object({
      articleNumber: z.string().nullable(),
      description: z.string(),
      quantity: z.number().nullable(),
      unitSize: z.number().nullable(),
      totalUnits: z.number().nullable(),
      unitPrice: z.number().nullable(),
      discount: z.number().nullable(),
      lineTotal: z.number().nullable(),
      vatRate: z.number().nullable(),
    }),
  ),
  totals: z.object({
    totalExVat: z.number().nullable(),
    vatTotal: z.number().nullable(),
    totalIncVat: z.number().nullable(),
  }),
});

async function pdfToText(filePath) {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });
  try {
    const data = await parser.getText();
    return data.text;
  } finally {
    await parser.destroy();
  }
}

async function extractInvoice(text, fileName) {
  const prompt = `
Extract this invoice into JSON.

Rules:
- Return JSON only.
- Match this schema exactly:
{
  "invoiceNumber": string|null,
  "invoiceDate": "YYYY-MM-DD"|null,
  "supplier": { "name": string|null, "kvk": string|null, "vatNumber": string|null, "iban": string|null },
  "customer": { "name": string|null, "city": string|null, "debtorNumber": string|null },
  "lines": [{
    "articleNumber": string|null,
    "description": string,
    "quantity": number|null,
    "unitSize": number|null,
    "totalUnits": number|null,
    "unitPrice": number|null,
    "discount": number|null,
    "lineTotal": number|null,
    "vatRate": number|null
  }],
  "totals": { "totalExVat": number|null, "vatTotal": number|null, "totalIncVat": number|null }
}

Important:
- Dutch decimal commas become dots.
- Do not invent missing values.
- Preserve article numbers and descriptions exactly.
- Every product row must become one line item.

File: ${fileName}

Invoice text:
${text}
`;

  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const raw = res.choices[0].message.content;
  return InvoiceSchema.parse(JSON.parse(raw));
}

async function main() {
  const input = process.argv[2];

  if (!input) {
    console.error(
      "Usage: node parse-invoices.mjs ./invoice.pdf OR ./invoices-folder",
    );
    process.exit(1);
  }

  const stat = await fs.stat(input);
  const files = stat.isDirectory()
    ? (await fs.readdir(input))
        .filter((f) => f.toLowerCase().endsWith(".pdf"))
        .map((f) => path.join(input, f))
    : [input];

  const rows = [];

  for (const file of files) {
    console.log(`Parsing ${file}...`);

    const text = await pdfToText(file);
    const invoice = await extractInvoice(text, path.basename(file));

    for (const line of invoice.lines) {
      rows.push({
        source_file: path.basename(file),
        invoice_number: invoice.invoiceNumber,
        invoice_date: invoice.invoiceDate,
        supplier_name: invoice.supplier.name,
        supplier_kvk: invoice.supplier.kvk,
        supplier_vat: invoice.supplier.vatNumber,
        supplier_iban: invoice.supplier.iban,
        customer_name: invoice.customer.name,
        customer_city: invoice.customer.city,
        debtor_number: invoice.customer.debtorNumber,
        article_number: line.articleNumber,
        description: line.description,
        quantity: line.quantity,
        unit_size: line.unitSize,
        total_units: line.totalUnits,
        unit_price: line.unitPrice,
        discount: line.discount,
        line_total: line.lineTotal,
        vat_rate: line.vatRate,
        invoice_total_ex_vat: invoice.totals.totalExVat,
        invoice_vat_total: invoice.totals.vatTotal,
        invoice_total_inc_vat: invoice.totals.totalIncVat,
        currency: "EUR",
      });
    }
  }

  const csv = stringify(rows, { header: true });
  await fs.writeFile("hvas-invoices.csv", csv);

  console.log(`Done. Wrote ${rows.length} rows to hvas-invoices.csv`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
