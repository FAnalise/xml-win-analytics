export type ParsedItem = {
  sku: string;
  description: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
};

export type ParsedInvoice = {
  number: string;
  accessKey: string | null;
  issueDate: string;
  customer: string;
  seller: string;
  platform: string;
  total: number;
  items: ParsedItem[];
};

const PLATFORMS: Array<[RegExp, string]> = [
  [/mercado\s*liv|mercadolivre|meli\b/i, "Mercado Livre"],
  [/shopee/i, "Shopee"],
  [/amazon/i, "Amazon"],
  [/magalu|magazine\s*luiza/i, "Magalu"],
  [/americanas|b2w|submarino|shoptime/i, "Americanas"],
  [/shein/i, "Shein"],
  [/tiktok/i, "TikTok Shop"],
  [/via\s*varejo|casas\s*bahia|ponto\s*frio/i, "Casas Bahia"],
  [/netshoes|centauro/i, "Netshoes"],
  [/olist/i, "Olist"],
  [/tray|nuvemshop|nuvem\s*shop|woocommerce|shopify|loja\s*virtual|e-?commerce/i, "Loja Própria"],
];

function text(parent: Element | Document | null, tag: string): string {
  if (!parent) return "";
  const el = parent.getElementsByTagName(tag)[0] ?? parent.getElementsByTagName("nfe:" + tag)[0];
  return el?.textContent?.trim() ?? "";
}

function num(value: string): number {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function detectPlatform(blob: string): string {
  for (const [pattern, name] of PLATFORMS) {
    if (pattern.test(blob)) return name;
  }
  return "Outros";
}

function detectSeller(blob: string): string {
  const match =
    /vendedor\s*[:\-]\s*([^\n;|.]{2,60})/i.exec(blob) ??
    /operador\s*[:\-]\s*([^\n;|.]{2,60})/i.exec(blob) ??
    /representante\s*[:\-]\s*([^\n;|.]{2,60})/i.exec(blob);
  return match?.[1] ? match[1].trim() : "Não informado";
}

/** Parses a Brazilian NFe XML (Tiny/Olist export) into invoice + item data. */
export function parseNfeXml(xml: string): ParsedInvoice {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("XML inválido");
  }

  const infNFe = doc.getElementsByTagName("infNFe")[0];
  const ide = doc.getElementsByTagName("ide")[0] ?? null;
  if (!ide) throw new Error("XML não parece ser uma NF-e");

  const number = text(ide, "nNF") || "s/n";
  const rawDate = text(ide, "dhEmi") || text(ide, "dEmi");
  const issueDate = rawDate ? rawDate.slice(0, 10) : new Date().toISOString().slice(0, 10);

  const accessKeyRaw = infNFe?.getAttribute("Id") ?? "";
  const accessKey = accessKeyRaw ? accessKeyRaw.replace(/\D/g, "") : null;

  const destEl = doc.getElementsByTagName("dest")[0] ?? null;
  const customer = text(destEl, "xNome") || "Consumidor";

  const infAdic = doc.getElementsByTagName("infAdic")[0] ?? null;
  const obsBlob = infAdic ? (infAdic.textContent ?? "") : "";
  const blob = `${obsBlob} ${text(doc, "xPed")}`;

  const items: ParsedItem[] = [];
  const dets = Array.from(doc.getElementsByTagName("det"));
  for (const det of dets) {
    const prod = det.getElementsByTagName("prod")[0];
    if (!prod) continue;
    const quantity = num(text(prod, "qCom"));
    const unitValue = num(text(prod, "vUnCom"));
    const totalValue = num(text(prod, "vProd")) || quantity * unitValue;
    items.push({
      sku: text(prod, "cProd") || "SEM-SKU",
      description: text(prod, "xProd") || "Produto sem descrição",
      quantity,
      unitValue,
      totalValue,
    });
  }

  const totalEl = doc.getElementsByTagName("ICMSTot")[0] ?? null;
  const total =
    num(text(totalEl, "vNF")) || items.reduce((sum, item) => sum + item.totalValue, 0);

  return {
    number,
    accessKey,
    issueDate,
    customer,
    seller: detectSeller(blob),
    platform: detectPlatform(blob),
    total,
    items,
  };
}