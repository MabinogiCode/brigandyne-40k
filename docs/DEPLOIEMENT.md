# Récupérer et recompiler le système (serveur Linux / Oracle Ampere ARM64)

Ce guide explique comment **mettre à jour** le système Warhammer 40 000 : Brigandyne
sur un serveur Foundry (ex. Oracle Cloud Ampere, Ubuntu ARM64) après un `git push`
depuis la machine de dev.

> **Pourquoi recompiler ?** Les compendiums sont stockés en base **LevelDB** (binaire).
> Le dépôt ne versionne plus que la **source JSON** (`packs/_source/`) : on régénère
> la base LevelDB localement avec `npm run pack`. Ça évite les conflits Git permanents
> (LevelDB réécrit `LOG`, `CURRENT`, `MANIFEST…` dès que Foundry ouvre le monde).

---

## 🔄 Mise à jour courante (le cas normal)

```bash
cd ~/Git/brigandyne-40k
git pull --prune
npm run pack          # recompile les packs LevelDB depuis packs/_source
```

Puis **relancer** le monde Foundry (ou recharger l'application) pour voir les changements.

> Si la **source de contenu** a changé (rare, signalé dans le commit), faire avant :
> `npm run import && npm run pack`.

---

## 🆘 « Your local changes … would be overwritten by merge » (packs/)

C'est le symptôme des packs LevelDB modifiés au runtime. **Sur un serveur de déploiement
(qui ne fait que tirer le dépôt), la solution la plus sûre est de jeter l'état local des packs :**

```bash
cd ~/Git/brigandyne-40k

# 1. On se cale exactement sur le dépôt distant (jette les modifs locales suivies)
git fetch origin
git reset --hard origin/main

# 2. On supprime les fichiers de packs non suivis laissés par LevelDB
git clean -fd packs/

# 3. On recompile les packs en local
npm run pack
```

> `git reset --hard origin/main` écrase **toutes** les modifications locales suivies.
> C'est sans danger sur une machine qui ne fait que déployer (aucune édition locale à
> conserver). Si tu as des modifs locales à garder, fais plutôt `git stash` d'abord.

Variante plus douce (ne touche qu'à `packs/`) :

```bash
git checkout -- packs/   # annule les modifs sur les fichiers de packs suivis
git clean -fd packs/     # retire les fichiers de packs non suivis
git pull --prune
npm run pack
```

---

## 🧱 Première installation sur un serveur neuf

### 1. Prérequis

- **Node.js 24+** (Foundry VTT v14 l'exige) et **npm**.
  ```bash
  node -v   # doit afficher v24.x ou plus
  ```
  Si besoin (Ubuntu), installer Node 24 via nodesource ou nvm :
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs build-essential   # build-essential : pour les modules natifs ARM
  ```

### 2. Cloner le dépôt

```bash
mkdir -p ~/Git && cd ~/Git
git clone git@github.com:MabinogiCode/brigandyne-40k.git
cd brigandyne-40k
```

### 3. Installer les dépendances (module natif `classic-level`)

```bash
npm install
```
> `classic-level` (LevelDB) est un **module natif** : `npm install` télécharge ou compile
> le binaire **ARM64**. C'est pourquoi `build-essential` est utile sur Ampere.

### 4. Compiler les packs

```bash
npm run pack
```

### 5. Rendre le système visible par Foundry

Foundry charge les systèmes depuis `<dataPath>/Data/systems/`. On y crée un **lien
symbolique** vers le dépôt (adapter le chemin de ton `dataPath`) :

```bash
ln -s ~/Git/brigandyne-40k ~/foundrydata/Data/systems/brigandyne-40k
```
> Vérifie le `dataPath` réel de ton install (souvent `~/foundrydata` ou `~/.local/share/FoundryVTT`).

### 6. (Re)lancer Foundry

Relance le service Foundry, ouvre le monde → le système et ses compendiums sont prêts.

---

## ✅ Récapitulatif express

| Situation | Commandes |
|---|---|
| Mise à jour normale | `git pull --prune && npm run pack` |
| Conflit packs/ | `git reset --hard origin/main && git clean -fd packs/ && npm run pack` |
| Contenu source modifié | `git pull && npm run import && npm run pack` |
| Install neuve | `git clone … && npm install && npm run pack` + lien symbolique |

> ⚠️ Toujours **arrêter le serveur Foundry avant `npm run pack`** (LevelDB verrouille
> les fichiers du pack ouvert).
