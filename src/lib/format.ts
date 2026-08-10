export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );

export const pct = (value: number | null) =>
  value === null || !Number.isFinite(value)
    ? "—"
    : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;

export const qty = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value ?? 0);

export const factor = (value: number | null) =>
  value === null || !Number.isFinite(value)
    ? "—"
    : `${new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)}x`;

export const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y}` : iso;
};

export const monthLabel = (ym: string) => {
  const [y = "", m = ""] = ym.split("-");
  const names = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${names[Number(m) - 1] ?? m}/${y.slice(2)}`;
};