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

/** Ordem importa: padrões mais específicos primeiro (ex.: Mercado Full antes de Mercado Livre). */
const PLATFORMS: Array<[RegExp, string]> = [
  [
    /mercado\s*full|full\s*mercado|fulfillment\s*(do\s*)?mercado|meli\s*full|ml\s*full|mercado\s*liv\w*\s*full|envios?\s*full\b|\bfull\b(?=[^\n]{0,40}mercado)/i,
    "Mercado Full",
  ],
  [/mercado\s*liv|mercadolivre|mercadolibre|\bmeli\b|\bml\b\s*(venda|pedido|canal)|mercado\s*envios|mercado\s*pago/i, "Mercado Livre"],
  [/shopee|\bshp\b/i, "Shopee"],
  [/amazon|\bamzn\b|\bfba\b/i, "Amazon"],
  [/magalu|magazine\s*luiza|netshoes|zattini/i, "Magalu"],
  [/americanas|\bb2w\b|submarino|shoptime/i, "Americanas"],
  [/shein/i, "Shein"],
  [/tiktok/i, "TikTok Shop"],
  [/via\s*varejo|casas\s*bahia|ponto\s*frio|extra\.com/i, "Casas Bahia"],
  [/centauro/i, "Centauro"],
  [/olist/i, "Olist"],
  [/\bkabum\b/i, "KaBuM"],
  [/madeira\s*madeira/i, "MadeiraMadeira"],
  [/leroy\s*merlin/i, "Leroy Merlin"],
  [
    /loja\s*pr[óo]pria|site\s*pr[óo]prio|tray|nuvemshop|nuvem\s*shop|woocommerce|shopify|vtex|loja\s*integrada|wbuy|bagy|yampi|loja\s*virtual|e-?commerce\s*pr[óo]prio/i,
    "Loja Própria",
  ],
];

/** CNPJ raiz de intermediadores conhecidos (campo infIntermed/CNPJ ou destinatário logístico). */
const CNPJ_PLATFORMS: Array<[RegExp, string]> = [
  [/^10573521/, "Mercado Livre"], // MercadoLivre.com Atividades de Internet
  [/^03007331/, "Mercado Livre"], // Ebazar.com.br (Mercado Livre)
  [/^35635824/, "Shopee"], // Shopee do Brasil
  [/^15436940/, "Amazon"], // Amazon Serviços de Varejo do Brasil
  [/^47960950/, "Magalu"], // Magazine Luiza
  [/^00776574/, "Americanas"], // Americanas S.A.
  [/^33041260/, "Casas Bahia"], // Via / Casas Bahia
];

function text(parent: Element | Document | null, tag: string): string {
  if (!parent) return "";
  const el = parent.getElementsByTagName(tag)[0] ?? parent.getElementsByTagName("nfe:" + tag)[0];
  return el?.textContent?.trim() ?? "";
}

function allText(doc: Document, tag: string): string[] {
  const nodes = [
    ...Array.from(doc.getElementsByTagName(tag)),
    ...Array.from(doc.getElementsByTagName("nfe:" + tag)),
  ];
  return nodes.map((n) => n.textContent?.trim() ?? "").filter(Boolean);
}

function num(value: string): number {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[;|.,-]+$/, "").trim();
}

function detectPlatform(blob: string, intermedCnpj: string, intermedName: string): string {
  // 1) Nome do intermediador declarado na NF-e (idCadIntTran) é a fonte mais confiável.
  if (intermedName) {
    for (const [pattern, name] of PLATFORMS) {
      if (pattern.test(intermedName)) return name;
    }
  }
  // 2) CNPJ do intermediador.
  if (intermedCnpj) {
    for (const [pattern, name] of CNPJ_PLATFORMS) {
      if (pattern.test(intermedCnpj)) return name;
    }
  }
  // 3) Texto livre (observações, pedido, transportadora, entrega).
  for (const [pattern, name] of PLATFORMS) {
    if (pattern.test(blob)) return name;
  }
  // 4) Marketplace genérico informado sem nome reconhecido.
  if (intermedName) return clean(intermedName);
  return "Outros";
}

const SELLER_LABELS = [
  "vendedor\\(a\\)",
  "vendedor",
  "vendedora",
  "operador",
  "representante",
  "atendente",
  "canal de venda - vendedor",
  "consultor",
  "seller",
];

function detectSeller(blob: string, obsFields: Array<[string, string]>): string {
  // 1) Campos estruturados obsCont/obsFisco (xCampo/xTexto) usados pelo Tiny/Olist.
  for (const [field, value] of obsFields) {
    if (/vendedor|operador|representante|consultor|atendente|seller/i.test(field) && value) {
      return clean(value);
    }
  }
  // 2) Texto livre nas informações complementares.
  for (const label of SELLER_LABELS) {
    const match = new RegExp(`${label}\\s*[:\\-]\\s*([^\\n;|]{2,60})`, "i").exec(blob);
    if (match?.[1]) {
      const value = clean(match[1]);
      if (value && !/^n[ãa]o\s*informad/i.test(value)) return value;
    }
  }
  return "Não informado";
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

  // Campos estruturados de observação (Tiny/Olist gravam vendedor e canal aqui).
  const obsFields: Array<[string, string]> = [];
  for (const tag of ["obsCont", "obsFisco"]) {
    const nodes = [
      ...Array.from(doc.getElementsByTagName(tag)),
      ...Array.from(doc.getElementsByTagName("nfe:" + tag)),
    ];
    for (const node of nodes) {
      const field = node.getAttribute("xCampo") ?? "";
      const value = text(node, "xTexto");
      if (field || value) obsFields.push([field, value]);
    }
  }

  const infAdic = doc.getElementsByTagName("infAdic")[0] ?? null;
  const intermed = doc.getElementsByTagName("infIntermed")[0] ?? null;
  const intermedCnpj = intermed ? text(intermed, "CNPJ").replace(/\D/g, "") : "";
  const intermedName = intermed ? text(intermed, "idCadIntTran") : "";

  const blobParts = [
    infAdic ? (infAdic.textContent ?? "") : "",
    ...allText(doc, "xPed"),
    ...allText(doc, "infCpl"),
    ...allText(doc, "infAdFisco"),
    ...obsFields.map(([field, value]) => `${field}: ${value}`),
    intermedName,
    text(doc.getElementsByTagName("transporta")[0] ?? null, "xNome"),
    text(doc.getElementsByTagName("entrega")[0] ?? null, "xNome"),
    text(doc.getElementsByTagName("retirada")[0] ?? null, "xNome"),
    customer,
  ];
  const blob = blobParts.filter(Boolean).join(" \n ");

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
    seller: detectSeller(blob, obsFields),
    platform: detectPlatform(blob, intermedCnpj, intermedName),
    total,
    items,
  };
}
