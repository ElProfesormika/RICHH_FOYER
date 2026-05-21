# Rapport explicatif — Foyer_UTT
## Prévision de demande et aide à la commande

**Application** : gestion des stocks et commandes fournisseur (Metro) pour le foyer étudiant UTT.  
**Données** : 57 058 ventes historiques, 181 produits, stocks Metro réels (`app_db.sql`).  
**Horizon de prévision** : 14 jours.

---

## 1. Objectif du système

Le permanencier doit savoir **combien commander** avant rupture, en respectant un **seuil minimum fournisseur de 400 €**. Le système enchaîne trois étapes :

1. **Prévoir la demande** sur 14 jours (D).
2. **Calculer le stock de sécurité** (SS) pour absorber l’aléa pendant le délai fournisseur.
3. **Proposer une quantité** : Q = max(0, ⌈D + SS − S⌉), puis ajuster si le montant total est sous 400 €.

Le cœur « intelligent » est l’étape 1 : un **modèle de machine learning** par produit.

---

## 2. Modèle retenu : XGBoost (régression)

### 2.1 Description

**XGBoost** (*eXtreme Gradient Boosting*) est un algorithme d’**ensemble** qui combine plusieurs arbres de décision de façon séquentielle. Chaque arbre corrige les erreurs du précédent. En régression (`reg:squarederror`), il prédit une **quantité vendue par jour** à partir de variables explicatives (lags, moyennes mobiles, calendrier).

Paramètres utilisés dans l’application :

| Paramètre | Valeur | Rôle |
|-----------|--------|------|
| `n_estimators` | 300 | Nombre d’arbres |
| `learning_rate` | 0,05 | Pas d’apprentissage (régularisation) |
| `max_depth` | 6 | Profondeur max des arbres |
| `objective` | `reg:squarederror` | Erreur quadratique (ventes continues) |

### 2.2 Justification du choix

#### Contexte métier

- **181 séries temporelles** (une par produit), volumes très différents (café, snacks, boissons).
- Historique **journalier agrégé** (~258 jours de vente).
- Patterns **non purement linéaires** : effet week-end, vacances scolaires, saisonnalité hebdomadaire, pics ponctuels.
- Besoin de **recalcul rapide** à chaque vente ou ajustement de stock (~0,5 s par produit).

#### Pourquoi XGBoost plutôt que…

| Approche | Avantages | Limites dans notre cas | Verdict |
|----------|-----------|-------------------------|---------|
| **Moyenne mobile / naïf** | Simple, rapide | Ignore week-end, vacances, tendance | Utilisé seulement en **secours** si historique insuffisant |
| **ARIMA / SARIMA** | Référence statistique pour séries temporelles | Un modèle par produit = lourd à maintenir ; peu de variables externes (vacances) ; sensibles aux séries courtes ou intermittentes | Écarté |
| **Prophet (Meta)** | Gère tendance + saisonnalité | Dépendance lourde ; moins flexible pour 181 produits hétérogènes ; recalcul fréquent coûteux | Écarté |
| **LSTM / deep learning** | Capture patterns complexes | Peu de données par produit ; entraînement lent ; boîte noire difficile à expliquer aux permanenciers | Écarté |
| **XGBoost** | Excellents résultats sur données tabulaires ; intègre facilement **lags + calendrier + vacances** ; entraînement **par produit** rapide ; robuste aux valeurs manquantes | Nécessite un minimum d’historique (~60 jours) | **Retenu** |

#### Arguments décisifs

1. **Données structurées en tableau** : chaque jour est une ligne avec des features (retards, moyennes, jour de la semaine). XGBoost est l’un des meilleurs algorithmes pour ce format (Kaggle, industrie retail).
2. **Séries courtes mais riches** : avec 60–250 points par produit, les modèles deep learning sur-apprennent ; les arbres boostés généralisent mieux.
3. **Variables métier explicites** : vacances UTT, week-end, mois sont injectés directement — sans reformuler toute la série.
4. **Un modèle par produit** : un Coca et un Kinder n’ont pas la même dynamique ; l’entraînement local évite un modèle global biaisé.
5. **Performance opérationnelle** : recalcul en temps réel après chaque saisie, compatible déploiement Railway (CPU, pas de GPU).
6. **Indicateur de qualité** : **MAE** (erreur absolue moyenne) sur 20 % de l’historique en validation, affichable pour comparer les produits.

---

## 3. Ingénierie des variables (features)

Les ventes journalières brutes sont enrichies avant entraînement :

| Feature | Signification |
|---------|----------------|
| `lag_1`, `lag_7`, `lag_14`, `lag_28` | Ventes des jours précédents (mémoire courte et saisonnalité) |
| `rolling_mean_7`, `rolling_mean_30` | Tendances lissées |
| `rolling_std_30` | Volatilité récente (liée au stock de sécurité) |
| `dow`, `month`, `week` | Calendrier |
| `is_weekend` | Effet week-end (foyer plus fréquenté) |
| `vacances` | Périodes de vacances scolaires 2025–2026 (baisse d’affluence campus) |

**Minimum requis** : 60 jours d’historique et au moins 30 jours exploitables après création des lags (notamment `lag_28`).

---

## 4. Méthode d’entraînement et de prévision

### 4.1 Entraînement

- Découpage **80 % train / 20 % test** chronologique (pas de mélange aléatoire : respect du temps).
- Métrique : **MAE** sur le jeu test.
- Un **XGBRegressor** par produit.

### 4.2 Prévision sur 14 jours (multi-étapes)

La demande sur l’horizon n’est pas un simple « moyenne × 14 » :

1. Le modèle prédit le **jour J+1**.
2. Cette prédiction est ajoutée à l’historique.
3. On prédit **J+2**, etc., jusqu’à J+14 (**prévision récursive**).

La **demande totale D** = somme des 14 prévisions journalières.

Cette approche propage l’incertitude mais reflète mieux l’évolution si les ventes récentes changent (ex. après une grosse vente aujourd’hui).

### 4.3 Repli (fallback)

Si historique &lt; 60 jours ou features insuffisantes :

- D = moyenne des **14 derniers jours** × 14  
- σ = écart-type de la série  

Garantit une réponse pour tous les produits, avec une précision moindre.

---

## 5. De la prévision à la commande

### Stock de sécurité (formule classique)

**SS = z × σ × √L**

- **z = 1,65** → environ **95 %** de niveau de service (normale centrée).
- **σ** : écart-type des ventes journalières historiques.
- **L = 3 jours** : délai de réapprovisionnement Metro.

### Quantité à commander

**Q = max(0, ⌈D + SS − S⌉)**  
avec **S** = stock actuel (Metro si code article connu, sinon stock estimé).

### Seuil fournisseur 400 €

Si le montant total &lt; 400 €, toutes les quantités sont multipliées par **R_min = 400 / montant** pour atteindre le minimum commandable.

---

## 6. Mise à jour en temps réel

À chaque **vente** ou **ajustement de stock** :

1. Recalcul XGBoost **du produit concerné**.
2. Reconstruction de **toute la commande suggérée** (167 lignes typiques, seuil 400 €).

Plus besoin de bouton « Recalculer » : le modèle suit l’activité du foyer.

---

## 7. Limites et pistes d’amélioration

| Limite | Explication | Piste |
|--------|-------------|--------|
| Historique court sur nouveaux produits | Fallback moins précis | Enrichir au fil des ventes réelles |
| Prévision récursive | Erreurs qui s’accumulent sur 14 jours | Horizon glissant ou modèle direct multi-sorties |
| Vacances codées en dur | Liste 2025–2026 | Mise à jour annuelle ou calendrier UTT officiel |
| 33 / 181 produits liés au stock Metro | Reste estimé | Affiner le mapping TPE ↔ code article |
| Pas de météo / événements | Pics non expliqués | Variables externes si disponibles |

---

## 8. Synthèse

**XGBoost** a été choisi car il offre le meilleur compromis pour le Foyer_UTT : **précision** sur séries journalières courtes, **intégration du calendrier et des vacances**, **rapidité** de recalcul, et **déploiement simple** (CPU, open source). Il alimente une chaîne décisionnelle claire — prévision → stock de sécurité → commande — adaptée au travail des permanenciers et aux contraintes du fournisseur Metro.

---

*Document généré pour le projet Foyer_UTT — module de prévision `backend/app/ml/`.*
