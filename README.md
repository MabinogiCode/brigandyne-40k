# Warhammer 40,000 : Brigandyne — Système Foundry VTT

Adaptation du système **Brigandyne 2ᵉ édition** (James Tornade / Le Grimoire) à
l'univers de **Warhammer 40,000**, pour **Foundry VTT v14**.

> Simulateur grimdark « Chair & Sang » : d100 sous caractéristique, six degrés de
> réussite, points de Destin, Psykers du Warp et Vraie Foi de l'Empereur.

## ✨ Fonctionnalités

- 🎲 **Moteur d100** : jet sous caractéristique, Avantage/Désavantage (±10, cap ±3,
  conforme RAW), six degrés de réussite (Réussite Critique → Échec Critique) avec
  les exceptions < 20 % / ≥ 80 %, dé d'unité (RU), **relance en Sang-froid** (−4/−6).
- 🧑‍🚀 **Personnages** : 13 caractéristiques-compétences, jauges PV et Sang-Froid
  (SF), Destin, Corruption, Vices & Vertus, espèces et carrières par Adeptus.
- ⚔️ **Combat** : attaque → dégâts (RU + bonus, Perce-armure vs Protection),
  munitions, initiative et turn order, conditions.
- 🔫 **Armes 40K** : chargeurs et rechargement, coup par coup / semi-auto / rafale,
  Viser, Couvert, Surchauffe, Destruction, Décupleur, portée, échelle
  humaine / véhicule / vaisseau.
- 🩸 **Blessures graves** : séquelles d100 du Livre Premier (p.196-197), Folie, Destin
  définitif, Corruption et Mutations.
- 🔮 **Psykers** : 5 disciplines, pouvoirs et pouvoirs mineurs (deux compteurs),
  Résistance de la cible, Gêne du Paria, Forcer le Warp, tables des Phénomènes
  psychiques et des Périls du Warp automatisées.
- ✝️ **Vraie Foi** : Actes de Foi et Miracles, conditions d'accès, limite journalière.
- 🦾 **Augmentations** : limite *VOL*, effets chiffrés automatiques.
- 📚 **Compendiums** : armes, armures, munitions, équipement & améliorations, espèces,
  carrières, talents, spécialités, pouvoirs, Actes de Foi, augmentations, blessures
  graves, véhicules, bestiaire — chaque ligne est comparée au document d'adaptation par
  la suite de tests.

## 🚀 Installation dans Foundry VTT

### Via le manifest (recommandé)

1. Dans Foundry, ouvrez **Game Systems → Install System**.
2. Collez cette URL dans le champ **Manifest URL** :

   ```
   https://github.com/MabinogiCode/brigandyne-40k/releases/latest/download/system.json
   ```

3. Cliquez sur **Install**. Les mises à jour se font ensuite depuis le même écran.

### Manuellement

1. Téléchargez `brigandyne-40k.zip` depuis la
   [dernière release](https://github.com/MabinogiCode/brigandyne-40k/releases/latest).
2. Décompressez-le dans `Data/systems/brigandyne-40k/` de votre installation Foundry.
3. Redémarrez Foundry : le système apparaît dans la liste des Game Systems.

> ⚠️ N'installez pas le système en clonant le dépôt : les compendiums LevelDB
> compilés ne sont pas versionnés (voir Développement). Les archives de release,
> elles, les contiennent.

### Publier une nouvelle version (mainteneur)

```bash
# 1. Mettre à jour "version" dans system.json et package.json (identiques)
# 2. Committer, puis taguer :
git tag v0.7.0 && git push origin main --tags
# Le workflow .github/workflows/release.yml lance les tests, compile les packs,
# construit le zip et publie la release (system.json + brigandyne-40k.zip).
```

## 🧰 Installation (dev local)

Ce dépôt est lié au dossier `Data/systems/` de Foundry via une **jonction**
Windows, donc Foundry charge directement la version de travail.

```powershell
# (déjà fait par le script d'installation)
New-Item -ItemType Junction -Path "C:\Perso\Foundry\Data\systems\brigandyne-40k" -Target "C:\Git-perso\brigandyne-40k"
```

## 🛠️ Développement

```bash
npm install            # dépendances (esbuild, typescript, foundryvtt-cli…)
npm run build          # bundle src/**/*.ts → dist/brigandyne40k.mjs (esbuild)
npm run typecheck      # vérification TypeScript (tsc --noEmit)
npm run pack           # compile packs/_source/*.json → packs LevelDB
npm test               # suite de tests : règles (page par page), données (tableau par tableau), colle Foundry
npm run import:equipment   # régénère le compendium Équipement depuis le document 40K
npm run import:sequelae    # régénère les blessures graves depuis la table du Livre Premier p.197
# ⚠️ `npm run import` (importeur historique) est BLOQUÉ : il écraserait les compendiums corrigés
#    à la main. Les compendiums se modifient dans packs/_source (source de vérité, testée).
```

Le code est en **TypeScript** (`src/`), bundlé par esbuild vers `dist/` (non
versionné — après un `git pull` : `npm run build`). Les tests tournent
directement sur les `.ts` grâce au type-stripping natif de Node ≥ 22.18.

La conformité aux règles est verrouillée par la suite de tests : chaque règle du
Livre Premier testable cite sa page (`test/*.test.mjs`), et les compendiums sont
validés champ par champ (archétypes p. 40-47, carrières 10 spécialités + 10
talents p. 110/115, équipements de base p. 26/57…). La CI GitHub
(`.github/workflows/ci.yml`) rejoue ces tests à chaque push.

- Code : TypeScript, `DataModels` + `ApplicationV2` (globaux Foundry déclarés
  dans `types/foundry.d.ts`).
- `src/` : config, données, documents, dés, feuilles.
- `packs/_source/` : sources JSON des compendiums (**versionnées** — source de vérité).
- Les **packs LevelDB compilés ne sont pas versionnés** (ils muteraient au runtime et
  créeraient des conflits Git). Après un `git pull` : **`npm run pack`** pour les régénérer.
- `tools/` : extracteur .docx/PDF et importeurs de contenu.

📦 **Déploiement / mise à jour sur un serveur (Linux, Oracle Ampere ARM…)** :
voir [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) (release GitHub + bouton *Update* de Foundry).
🔍 **Audit de conformité** au Livre Premier et à l'adaptation 40K : [`docs/AUDIT-CONFORMITE.md`](docs/AUDIT-CONFORMITE.md).

## ⚖️ Licence & propriété intellectuelle

Code sous licence **MIT** (voir `LICENSE`). Brigandyne © James Tornade ;
Warhammer 40,000 © Games Workshop. Projet **amateur, non commercial**.
