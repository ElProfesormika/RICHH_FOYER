import { CommandeResume } from "../api";
import { commandeTotaux, fmtEur, lignesExportCommande } from "./commandeTotals";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("fr-FR");
}

/** Export CSV — commande consolidée (cumul prévisions 14 j) + détail lignes. */
export function exportCommandeCsv(
  commande: CommandeResume,
  horizonJours: number
): void {
  const ref = commande.reference_commande ?? "CMD";
  const date = commande.date_calcul
    ? new Date(commande.date_calcul).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const filename = `commande-foyer-utt-${ref}-${date}.csv`;
  const t = commandeTotaux(commande);
  const exportLignes = lignesExportCommande(commande.lignes);

  const meta: string[][] = [
    ["Foyer_UTT — Commande fournisseur consolidée"],
    [
      "Description",
      `Cumul des prévisions sur ${horizonJours} jours — détail par produit`,
    ],
    ["Référence commande", ref],
    ["Date calcul", fmtDate(commande.date_calcul)],
    ["Horizon prévision (jours)", String(horizonJours)],
    ["Prévision cumulée (unités ventes estimées)", t.demandeCumul14j.toFixed(2)],
    ["Besoin cumulé D+SS (unités)", t.besoinCumul14j.toFixed(2)],
    ["Produits avec prévision 14j", String(t.nbProduitsPrevision)],
    ["Produits à commander (qté > 0)", String(t.nbLignesACommander)],
    ["Quantité totale à commander (unités)", String(t.nbUnites)],
    ["Montant total commande HT (EUR)", fmtEur(t.montantTotal)],
    ["Seuil fournisseur (EUR)", String(commande.seuil_fournisseur)],
    [
      "Seuil atteint",
      commande.seuil_atteint ? "oui" : "non (ajustement R min)",
    ],
    [],
    ["=== DÉTAIL DES LIGNES DE COMMANDE ==="],
    [],
  ];

  const headers = [
    "N°",
    "Nom_produit",
    "Code_article",
    `Prevision_cumul_${horizonJours}j_unites`,
    "Quantite_a_commander",
    "Prix_unitaire_HT_EUR",
    "Total_ligne_HT_EUR",
  ];

  const rows = exportLignes.map((l) => [
    String(l.numero),
    l.nom,
    l.code,
    l.prevision14j.toFixed(2),
    String(l.quantite),
    l.prixUnitaire.toFixed(2),
    l.total.toFixed(2),
  ]);

  const footer: string[][] = [
    [],
    [
      "",
      "TOTAL COMMANDE",
      "",
      t.demandeCumul14j.toFixed(2),
      String(t.nbUnites),
      "",
      fmtEur(t.montantTotal),
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
