import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CommandeResume } from "../api";
import { commandeTotaux, fmtEur, lignesExportCommande } from "./commandeTotals";

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Facture PDF — commande consolidée (cumul 14 j) : nom, qté, P.U., total. */
export function exportCommandePdf(
  commande: CommandeResume,
  horizonJours: number
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ref = commande.reference_commande ?? "CMD";
  const dateSlug = commande.date_calcul
    ? new Date(commande.date_calcul).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const t = commandeTotaux(commande);
  const exportLignes = lignesExportCommande(commande.lignes);

  const margin = 14;
  let y = 18;

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, 210, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Foyer_UTT", margin, y);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Commande fournisseur — cumul prévisions", margin, y + 8);
  doc.setFontSize(9);
  doc.text(
    `Consolidation sur ${horizonJours} jours (XGBoost + stock de sécurité)`,
    margin,
    y + 14
  );

  doc.setTextColor(40, 40, 40);
  y = 46;
  doc.setFontSize(10);
  doc.text(`Référence : ${ref}`, margin, y);
  doc.text(`Date : ${fmtDate(commande.date_calcul)}`, margin, y + 6);

  doc.setFont("helvetica", "bold");
  doc.text("Récapitulatif commande", margin, y + 14);
  doc.setFont("helvetica", "normal");
  const recap = [
    [
      `Prévision cumulée (${horizonJours} j)`,
      `${Math.round(t.demandeCumul14j)} unités`,
    ],
    ["Quantité totale à commander", `${t.nbUnites} unités`],
    ["Produits avec prévision 14j", `${t.nbProduitsPrevision}`],
    ["Produits à commander (qté > 0)", `${t.nbLignesACommander}`],
    ["Montant total HT", `${fmtEur(t.montantTotal)} EUR`],
  ];
  autoTable(doc, {
    startY: y + 18,
    body: recap,
    theme: "plain",
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 }, 1: { halign: "right" } },
  });

  const recapEnd =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Détail des lignes", margin, recapEnd + 8);

  const body = exportLignes.map((l) => [
    String(l.numero),
    l.nom.length > 38 ? `${l.nom.slice(0, 36)}…` : l.nom,
    String(Math.round(l.prevision14j)),
    String(l.quantite),
    fmtEur(l.prixUnitaire),
    fmtEur(l.total),
  ]);

  autoTable(doc, {
    startY: recapEnd + 12,
    head: [
      [
        "N°",
        "Nom du produit",
        `Prév. ${horizonJours}j`,
        "Qté",
        "P.U. HT",
        "Total HT",
      ],
    ],
    body,
    foot: [
      [
        "",
        "TOTAL COMMANDE",
        String(Math.round(t.demandeCumul14j)),
        String(t.nbUnites),
        "",
        fmtEur(t.montantTotal),
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: 255,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [240, 244, 248],
      textColor: [30, 58, 95],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { halign: "right", cellWidth: 18 },
      3: { halign: "right", cellWidth: 14 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 24 },
    },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? recapEnd + 80;

  let footY = finalY + 10;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Qté commandée = max(0, prévision ${horizonJours}j + stock sécurité − stock). Seuil ${commande.seuil_fournisseur} EUR : ${
      commande.seuil_atteint ? "atteint" : "ajusté (R min)"
    }.`,
    margin,
    footY,
    { maxWidth: 182 }
  );
  footY += 10;
  doc.setFontSize(8);
  doc.text(
    "Document généré par Foyer_UTT. Prévision cumulée = somme des ventes estimées sur l'horizon.",
    margin,
    footY
  );

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Foyer_UTT — ${ref} — page ${i}/${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  doc.save(`facture-foyer-utt-${ref}-${dateSlug}.pdf`);
}
