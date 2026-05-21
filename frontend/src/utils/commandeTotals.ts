import { CommandeLigne, CommandeResume } from "../api";

export function fmtEur(n: number): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function commandeTotaux(commande: CommandeResume) {
  const lignes = commande.lignes;
  const nbUnites =
    commande.nb_unites_total ??
    lignes.reduce((s, l) => s + l.qte_commande, 0);
  const demandeCumul14j =
    commande.demande_cumul_14j ??
    lignes.reduce((s, l) => s + l.demande_prevue, 0);
  const besoinCumul14j =
    commande.besoin_cumul_14j ??
    lignes.reduce(
      (s, l) => s + (l.besoin_total ?? l.demande_prevue + l.stock_securite),
      0
    );
  const montantLignes = lignes.reduce((s, l) => s + l.montant, 0);

  const aCommander = lignes.filter((l) => l.qte_commande > 0);

  return {
    nbLignes: commande.nb_lignes ?? lignes.length,
    nbProduitsPrevision:
      commande.nb_produits_prevision ?? lignes.length,
    nbLignesACommander:
      commande.nb_lignes_a_commander ?? aCommander.length,
    nbUnites,
    demandeCumul14j,
    besoinCumul14j,
    montantTotal: commande.montant_total,
    montantLignes,
    lignesACommander: aCommander,
  };
}

/** Lignes pour export CSV / PDF : nom, prévision 14j, qté, P.U., total. */
export function lignesExportCommande(lignes: CommandeLigne[]) {
  return lignes.map((l, i) => ({
    numero: i + 1,
    nom: l.produit_nom,
    code: l.code_article ?? "",
    prevision14j: l.demande_prevue,
    quantite: l.qte_commande,
    prixUnitaire: l.prix_achat,
    total: l.montant,
  }));
}
