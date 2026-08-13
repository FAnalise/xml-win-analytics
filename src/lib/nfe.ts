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
  /** Campo do XML que determinou a plataforma (ex.: "infIntermed/CNPJ"). */
  platformSource: string;
  /** Campo do XML que determinou o vendedor. */
  sellerSource: string;
};

/** Ordem importa: padrões mais específicos primeiro (ex.: Mercado Full antes de Mercado Livre). */
const PLATFORMS: Array<[RegExp, string]> = [
  [
    /mercado\s*full|full\s*mercado|fulfillment\s*(do\s*)?mercado|meli\s*full|ml\s*full|mercado\s*liv\w*\s*full|envios?\s*full\b|\bfull\b(?=[^\n]{0,40}mercado)/i,
    "Mercado Full",
  ],
  [
    /mercado\s*liv|mercadolivre|mercadolibre|ebazar|\bmeli\b|\bml\b\s*(venda|pedido|canal)|mercado\s*envios|mercado\s*pago/i,
    "Mercado Livre",
  ],
  [/shopee|\bshp\b/i, "Shopee"],
  [/amazon|\bamzn\b|\bfba\b/i, "Amazon"],
  [/magalu|magazine\s*luiza|netshoes|zattini|epoca\s*cosm/i, "Magalu"],
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
    /loja\s*pr[óo]pria|site\s*pr[óo]prio|\btray\b|nuvemshop|nuvem\s*shop|tiendanube|woocommerce|shopify|\bvtex\b|loja\s*integrada|wbuy|bagy|yampi|dooca|loja\s*virtual|e-?commerce\s*pr[óo]prio/i,
    "Loja Própria",
  ],
];

/** CNPJ raiz (8 primeiros dígitos) de marketplaces/intermediadores conhecidos. */
const CNPJ_PLATFORMS: Array<[string, string]> = [
  ["10573521", "Mercado Livre"], // MercadoLivre.com Atividades de Internet
  ["03007331", "Mercado Livre"], // Ebazar.com.br (Mercado Livre)
  ["18727053", "Mercado Livre"], // Mercado Pago
  ["35635824", "Shopee"], // Shopee do Brasil
  ["15436940", "Amazon"], // Amazon Serviços de Varejo do Brasil
  ["07044150", "Amazon"], // Amazon Serviços de Varejo (CDs)
  ["47960950", "Magalu"], // Magazine Luiza
  ["16624956", "Magalu"], // Netshoes
  ["00776574", "Americanas"], // Americanas S.A.
  ["33041260", "Casas Bahia"], // Via / Casas Bahia
  ["59291534", "Casas Bahia"], // Casas Bahia Comercial
  ["21285679", "Olist"], // Olist
  ["05570714", "KaBuM"],
  ["01631017", "Centauro"],
];

function text(parent: Element | Document | null, tag: string): string {
  if (!parent) return "";
  const el = parent.getElementsByTagName(tag)[0] ?? parent.getElementsByTagName("nfe:" + tag)[0];
  return el?.textContent?.trim() ?? "";
}

function nodes(doc: Document, tag: string): Element[] {
  return [
    ...Array.from(doc.getElementsByTagName(tag)),
    ...Array.from(doc.getElementsByTagName("nfe:" + tag)),
  ];
}

function allText(doc: Document, tag: string): string[] {
  return nodes(doc, tag)
    .map((n) => n.textContent?.trim() ?? "")
    .filter(Boolean);
}

function num(value: string): number {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[;|.,-]+$/, "").trim();
}

function matchPlatform(value: string): string | null {
  if (!value) return null;
  for (const [pattern, name] of PLATFORMS) {
    if (pattern.test(value)) return name;
  }
  return null;
}

function matchCnpj(cnpj: string): string | null {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const root = digits.slice(0, 8);
  for (const [prefix, name] of CNPJ_PLATFORMS) {
    if (root === prefix) return name;
  }
  return null;
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
  "respons[áa]vel",
];

/** Campos de origem candidatos, na ordem de confiança. */
type Candidate = { value: string; source: string };

function detectPlatform(candidates: Candidate[]): { platform: string; source: string } {
  // 1) CNPJs (intermediador, entrega, transportadora, destinatário) — mais confiável.
  for (const c of candidates) {
    if (!c.source.includes("CNPJ")) continue;
    const byCnpj = matchCnpj(c.value);
    if (byCnpj) return { platform: byCnpj, source: c.source };
  }
  // 2) Textos, na ordem de confiança.
  for (const c of candidates) {
    if (c.source.includes("CNPJ")) continue;
    const byText = matchPlatform(c.value);
    if (byText) return { platform: byText, source: c.source };
  }
  // 3) Intermediador informado mas não reconhecido: usa o nome declarado.
  const intermed = candidates.find((c) => c.source === "infIntermed/idCadIntTran" && c.value);
  if (intermed) return { platform: clean(intermed.value), source: intermed.source };
  return { platform: "Outros", source: "não identificado" };
}

function detectSeller(
  obsFields: Array<[string, string, string]>,
  blobs: Candidate[],
): { seller: string; source: string } {
  // 1) Campos estruturados obsCont/obsFisco (xCampo/xTexto) usados pelo Tiny/Olist.
  for (const [field, value, tag] of obsFields) {
    if (/vendedor|operador|representante|consultor|atendente|seller|respons/i.test(field) && value) {
      return { seller: clean(value), source: `${tag}[xCampo="${field}"]` };
    }
  }
  // 2) Texto livre, campo a campo (para saber a origem exata).
  for (const c of blobs) {
    if (!c.value || c.source.includes("CNPJ")) continue;
    for (const label of SELLER_LABELS) {
      const match = new RegExp(`${label}\\s*[:\\-]\\s*([^\\n;|]{2,60})`, "i").exec(c.value);
      const value = match?.[1] ? clean(match[1]) : "";
      if (value && !/^n[ãa]o\s*informad/i.test(value)) {
        return { seller: value, source: c.source };
      }
    }
  }
  return { seller: "Não informado", source: "não identificado" };
}

/** Parses a Brazilian NFe XML (Tiny/Olist export) into invoice + item data. */
/**
 * Regra definitiva de vendedor por plataforma.
 * Shopee/Amazon sempre usam a própria plataforma como vendedor.
 * Mercado Livre / Mercado Full / Loja Própria usam o vendedor específico quando existir.
 */
function applySellerRules(
  platform: string,
  detected: { seller: string; source: string },
): { seller: string; source: string } {
  const hasSpecific =
    Boolean(detected.seller) && !/^n[ãa]o informado$/i.test(detected.seller);

  if (platform === "Shopee" || platform === "Amazon") {
    return { seller: platform, source: `regra: vendedor = plataforma (${platform})` };
  }
  if (hasSpecific) return detected;

  if (platform === "Mercado Livre" || platform === "Mercado Full") {
    return { seller: "Mercado Livre", source: "regra: sem vendedor específico (Mercado Livre)" };
  }
  if (platform === "Loja Própria") {
    return { seller: "Loja Própria", source: "regra: sem vendedor específico (Loja Própria)" };
  }
  return detected;
}

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
  const obsFields: Array<[string, string, string]> = [];
  for (const tag of ["obsCont", "obsFisco"]) {
    for (const node of nodes(doc, tag)) {
      const field = node.getAttribute("xCampo") ?? "";
      const value = text(node, "xTexto");
      if (field || value) obsFields.push([field, value, tag]);
    }
  }

  const intermed = doc.getElementsByTagName("infIntermed")[0] ?? null;
  const intermedCnpj = intermed ? text(intermed, "CNPJ") : "";
  const intermedName = intermed ? text(intermed, "idCadIntTran") : "";
  const intermedXNome = intermed ? text(intermed, "xNome") : "";

  const entrega = doc.getElementsByTagName("entrega")[0] ?? null;
  const retirada = doc.getElementsByTagName("retirada")[0] ?? null;
  const transporta = doc.getElementsByTagName("transporta")[0] ?? null;
  const infAdic = doc.getElementsByTagName("infAdic")[0] ?? null;
  const card = doc.getElementsByTagName("card")[0] ?? null;
  const cardCnpj = card ? text(card, "CNPJ") : "";

  const candidates: Candidate[] = [
    { value: intermedCnpj, source: "infIntermed/CNPJ" },
    { value: intermedName, source: "infIntermed/idCadIntTran" },
    { value: intermedXNome, source: "infIntermed/xNome" },
    { value: text(ide, "natOp"), source: "ide/natOp" },
    { value: entrega ? text(entrega, "CNPJ") : "", source: "entrega/CNPJ" },
    { value: transporta ? text(transporta, "CNPJ") : "", source: "transporta/CNPJ" },
    { value: cardCnpj, source: "pag/card/CNPJ" },
    { value: destEl ? text(destEl, "CNPJ") : "", source: "dest/CNPJ" },
    ...obsFields.map(([field, value, tag]) => ({
      value: `${field}: ${value}`,
      source: `${tag}[xCampo="${field}"]`,
    })),
    { value: allText(doc, "infCpl").join(" \n "), source: "infAdic/infCpl" },
    { value: allText(doc, "infAdFisco").join(" \n "), source: "infAdic/infAdFisco" },
    { value: allText(doc, "xPed").join(" \n "), source: "prod/xPed" },
    { value: entrega ? text(entrega, "xNome") : "", source: "entrega/xNome" },
    { value: retirada ? text(retirada, "xNome") : "", source: "retirada/xNome" },
    { value: transporta ? text(transporta, "xNome") : "", source: "transporta/xNome" },
    { value: entrega ? (entrega.textContent ?? "") : "", source: "entrega" },
    { value: infAdic ? (infAdic.textContent ?? "") : "", source: "infAdic" },
    { value: customer, source: "dest/xNome" },
  ].filter((c) => c.value.trim().length > 0);

  const detected = detectPlatform(candidates);
  let platform = detected.platform;
  let platformSource = detected.source;

  // Mercado Full: fulfillment/logística do Mercado Livre (entrega em CD do ML).
  if (platform === "Mercado Livre") {
    const fullSignals: Candidate[] = candidates.filter(
      (c) =>
        c.source.startsWith("entrega") ||
        c.source === "infAdic/infCpl" ||
        c.source === "infAdic" ||
        c.source.startsWith("transporta") ||
        c.source.startsWith("obs"),
    );
    for (const c of fullSignals) {
      const isFullText = /\bfull\b|fulfillment|centro\s*de\s*distribui|\bcd\s*meli\b|dep[óo]sito\s*mercado/i.test(
        c.value,
      );
      const isMeliDelivery = c.source.startsWith("entrega") && matchCnpj(c.value) === "Mercado Livre";
      if (isFullText || isMeliDelivery) {
        platform = "Mercado Full";
        platformSource = c.source;
        break;
      }
    }
  }

  const detectedSeller = detectSeller(obsFields, candidates);
  const seller = applySellerRules(platform, detectedSeller);

  const items: ParsedItem[] = [];
  for (const det of Array.from(doc.getElementsByTagName("det"))) {
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
    seller: seller.seller,
    platform,
    total,
    items,
    platformSource,
    sellerSource: seller.source,
  };
}
