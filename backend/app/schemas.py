from datetime import date, datetime

from pydantic import BaseModel


class ProduitOut(BaseModel):
    id: int
    nom: str
    code_article: str | None = None
    type_produit: str | None = None
    prix_vente_ttc: float
    prix_achat: float
    stock_actuel: int
    delai_fournisseur_jours: int

    class Config:
        from_attributes = True


class ProduitUpdate(BaseModel):
    stock_actuel: int | None = None
    prix_achat: float | None = None


class DashboardKPI(BaseModel):
    total_produits: int
    total_ventes: int
    ventes_aujourdhui: int
    jours_vente: int
    periode_debut: date | None
    periode_fin: date | None
    montant_commande_suggeree: float
    seuil_fournisseur: float
    seuil_atteint: bool
    alertes_stock: int
    horizon_jours: int
    ml_pret: bool = False
    date_dernier_calcul_ml: datetime | None = None
    lignes_commande: int = 0
    produits_avec_prevision: int = 0


class MlStatusOut(BaseModel):
    mode: str
    description: str
    pret: bool
    produits_total: int
    produits_avec_prevision: int
    produits_xgboost: int = 0
    produits_fallback: int = 0
    produits_sans_prix_achat: int = 0
    prix_achat_moyen: float = 0.0
    lignes_commande: int
    montant_commande_eur: float
    seuil_fournisseur_eur: float
    seuil_atteint: bool
    horizon_jours: int
    date_dernier_calcul_commande: datetime | None
    date_dernier_calcul_prevision: datetime | None
    formule_commande: str
    formule_stock_securite: str


class PrevisionOut(BaseModel):
    produit_id: int
    produit_nom: str
    demande_prevue: float
    stock_securite: float
    stock_actuel: int
    mae: float | None
    risque_rupture: str
    horizon_jours: int

    class Config:
        from_attributes = True


class CommandeLigneOut(BaseModel):
    produit_id: int
    produit_nom: str
    stock_actuel: int
    demande_prevue: float
    stock_securite: float
    qte_commande: int
    prix_achat: float
    montant: float
    risque_rupture: str


class CommandeResumeOut(BaseModel):
    lignes: list[CommandeLigneOut]
    montant_total: float
    seuil_fournisseur: float
    seuil_atteint: bool
    date_calcul: datetime | None


class VenteTrendPoint(BaseModel):
    jour: date
    quantite: int


class TopProduitOut(BaseModel):
    produit_nom: str
    total_ventes: int


class StockOverviewOut(BaseModel):
    produit_id: int
    produit_nom: str
    stock_actuel: int
    prix_vente_ttc: float
    demande_prevue_horizon: float
    stock_securite: float
    qte_commande_suggeree: int
    risque_rupture: str
    jours_couverture: float


class VenteCreate(BaseModel):
    produit_id: int
    quantite: int = 1


class VenteResponse(BaseModel):
    produit_id: int
    produit_nom: str
    quantite: int
    stock_actuel: int
    risque_rupture: str
    date_vente: str


class VenteRecenteOut(BaseModel):
    id: int
    produit_nom: str
    quantite: int
    tarif_ttc: float
    date_vente: datetime
    stock_restant: int

    class Config:
        from_attributes = True
