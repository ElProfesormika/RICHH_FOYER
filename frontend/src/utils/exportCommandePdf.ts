import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CommandeResume } from "../api";

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

/** Facture / bon de commande PDF — en-tête Foyer_UTT. */
export function exportCommandePdf(
  commande: CommandeResume,
  horizonJours: number
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ref = commande.reference_commande ?? "CMD";
  const dateSlug = commande.date_calcul
    ? new Date(commande.date_calcul).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const margin = 14;
  let y = 18;

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Foyer_UTT", margin, y);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Bon de commande fournisseur (suggéré)", margin, y + 8);

  doc.setTextColor(40, 40, 40);
  y = 42;
  doc.setFontSize(10);
  doc.text(`Référence : ${ref}`, margin, y);
  doc.text(`Date du calcul : ${fmtDate(commande.date_calcul)}`, margin, y + 6);
  doc.text(
    `Horizon prévision : ${horizonJours} jours · Prévisions XGBoost + stock de sécurité`,
    margin,
    y + 12
  );

  const nbLignes = commande.nb_lignes ?? commande.lignes.length;
  const nbUnites =
    commande.nb_unites_total ??
    commande.lignes.reduce((s, l) => s + l.qte_commande, 0);

  doc.setFont("helvetica", "bold");
  doc.text(
    `${nbLignes} produit${nbLignes > 1 ? "s" : ""} · ${nbUnites} unités · ${commande.montant_total.toFixed(2)} EUR HT`,
    margin,
    y + 20
  );
  doc.setFont("helvetica", "normal");

  const body = commande.lignes.map((l) => [
    l.code_article ?? "—",
    l.produit_nom.length > 42 ? `${l.produit_nom.slice(0, 40)}…` : l.produit_nom,
    String(l.qte_commande),
    `${l.prix_achat.toFixed(2)}`,
    `${l.montant.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: y + 26,
    head: [["Réf. Metro", "Produit", "Qté", "P.U. HT (€)", "Montant HT (€)"]],
    body,
    foot: [
      [
        "",
        "TOTAL",
        String(nbUnites),
        "",
        commande.montant_total.toFixed(2),
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
      0: { cellWidth: 22 },
      2: { halign: "right", cellWidth: 14 },
      3: { halign: "right", cellWidth: 22 },
      4: { halign: "right", cellWidth: 28 },
    },
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 80;

  let footY = finalY + 10;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Seuil fournisseur : ${commande.seuil_fournisseur} EUR — ${
      commande.seuil_atteint
        ? "seuil atteint"
        : "montant ajusté (règle R min)"
    }`,
    margin,
    footY
  );
  footY += 6;
  doc.text(
    "Document généré automatiquement par Foyer_UTT. Les quantités suivent Q = max(0, D + SS − S).",
    margin,
    footY
  );
  footY += 5;
  doc.setFontSize(8);
  doc.text(
    "Prix unitaires : prix d'achat estimés (CSV / ratio). À valider avant envoi au fournisseur.",
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
