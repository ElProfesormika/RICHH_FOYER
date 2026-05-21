import { CommandeResume } from "../api";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("fr-FR");
}

/** Export CSV complet (toutes les lignes) avec en-tête Foyer_UTT. */
export function exportCommandeCsv(
  commande: CommandeResume,
  horizonJours: number
): void {
  const ref = commande.reference_commande ?? "CMD";
  const date = commande.date_calcul
    ? new Date(commande.date_calcul).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const filename = `commande-foyer-utt-${ref}-${date}.csv`;

  const meta: string[][] = [
    ["Foyer_UTT — Commande fournisseur suggérée"],
    ["Référence", ref],
    ["Date calcul", fmtDate(commande.date_calcul)],
    ["Horizon prévision (jours)", String(horizonJours)],
    ["Nombre de lignes", String(commande.nb_lignes ?? commande.lignes.length)],
    ["Unités commandées", String(commande.nb_unites_total ?? 0)],
    ["Montant total HT (EUR)", commande.montant_total.toFixed(2)],
    ["Seuil fournisseur (EUR)", String(commande.seuil_fournisseur)],
    ["Seuil atteint", commande.seuil_atteint ? "oui" : "non (R min)"],
    [],
  ];

  const headers = [
    "Reference",
    "Code_article",
    "Produit",
    "Stock_actuel",
    "Stock_commande",
    `Demande_${horizonJours}j`,
    "Stock_securite",
    "Besoin_D_plus_SS",
    "Qte_commande",
    "Prix_achat_EUR",
    "Prix_vente_TTC_EUR",
    "Montant_ligne_EUR",
    "Modele_prevision",
    "MAE",
    "Risque_rupture",
  ];

  const rows = commande.lignes.map((l) => [
    ref,
    l.code_article ?? "",
    l.produit_nom,
    String(l.stock_actuel),
    String(l.stock_commande ?? l.stock_actuel),
    l.demande_prevue.toFixed(2),
    l.stock_securite.toFixed(2),
    (l.besoin_total ?? l.demande_prevue + l.stock_securite).toFixed(2),
    String(l.qte_commande),
    l.prix_achat.toFixed(2),
    (l.prix_vente_ttc ?? 0).toFixed(2),
    l.montant.toFixed(2),
    l.modele_prevision ?? "",
    l.mae != null ? l.mae.toFixed(2) : "",
    l.risque_rupture,
  ]);

  const totalUnits =
    commande.nb_unites_total ??
    commande.lignes.reduce((s, l) => s + l.qte_commande, 0);

  const footer: string[][] = [
    [],
    [
      "",
      "",
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      String(totalUnits),
      "",
      "",
      commande.montant_total.toFixed(2),
      "",
      "",
      "",
    ],
  ];

  const escape = (v: string) => {
    const s = String(v);
    if (s.includes(";") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const sep = ";";
  const lines = [
    ...meta.map((r) => r.map(escape).join(sep)),
    headers.map(escape).join(sep),
    ...rows.map((r) => r.map(escape).join(sep)),
    ...footer.map((r) => r.map(escape).join(sep)),
  ];

  const blob = new Blob(["\ufeff" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
