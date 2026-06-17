# Warhammer 40,000 : Brigandyne — Système Foundry VTT

Adaptation du système **Brigandyne 2ᵉ édition** (James Tornade / Le Grimoire) à
l'univers de **Warhammer 40,000**, pour **Foundry VTT v14**.

> Simulateur grimdark « Chair & Sang » : d100 sous caractéristique, six degrés de
> réussite, points de Destin, Psykers du Warp et Vraie Foi de l'Empereur.

## ✨ Fonctionnalités

- 🎲 **Moteur d100** : jet sous caractéristique, Avantage/Désavantage, six degrés
  de réussite (Réussite Critique → Échec Critique), dé d'unité (RU), relance par
  point de Destin.
- 🧑‍🚀 **Personnages** : 13 caractéristiques-compétences, jauges PV et Sang-Froid
  (SF), Destin, Corruption, Vices & Vertus, espèces et carrières par Adeptus.
- ⚔️ **Combat** : attaque → dégâts (RU + bonus, Perce-armure vs Protection),
  munitions, initiative et turn order, conditions.
- 🔮 **Psykers** : 5 disciplines, tables des Phénomènes psychiques et des Périls
  du Warp automatisées.
- ✝️ **Vraie Foi** : Actes de Foi et Miracles.
- 📚 **Compendiums** : armes, armures, munitions, espèces, carrières, talents,
  spécialités, pouvoirs, Actes de Foi, augmentations, véhicules, bestiaire.

## 🚀 Installation (dev local)

Ce dépôt est lié au dossier `Data/systems/` de Foundry via une **jonction**
Windows, donc Foundry charge directement la version de travail.

```powershell
# (déjà fait par le script d'installation)
New-Item -ItemType Junction -Path "C:\Perso\Foundry\Data\systems\brigandyne-40k" -Target "C:\Git-perso\brigandyne-40k"
```

## 🛠️ Développement

```bash
npm install            # installe l'outil de compilation des packs (classic-level natif)
npm run import         # (ré)génère les sources de compendiums depuis tes .docx
npm run pack           # compile packs/_source/*.json → packs LevelDB
```

- Code : ESM natif (pas de build lourd), `DataModels` + `ApplicationV2`.
- `module/` : config, données, documents, dés, feuilles.
- `packs/_source/` : sources JSON des compendiums (**versionnées** — source de vérité).
- Les **packs LevelDB compilés ne sont pas versionnés** (ils muteraient au runtime et
  créeraient des conflits Git). Après un `git pull` : **`npm run pack`** pour les régénérer.
- `tools/` : extracteur .docx/PDF et importeurs de contenu.

📦 **Déploiement / mise à jour sur un serveur (Linux, Oracle Ampere ARM…)** :
voir [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md).

## ⚖️ Licence & propriété intellectuelle

Code sous licence **MIT** (voir `LICENSE`). Brigandyne © James Tornade ;
Warhammer 40,000 © Games Workshop. Projet **amateur, non commercial**.
