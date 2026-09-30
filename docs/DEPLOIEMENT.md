# Mettre à jour le système sur un serveur Foundry (Oracle Cloud / OCI, Ampere ARM64)

> **La bonne façon (recommandée)** : publier une *release* GitHub depuis ta machine, puis cliquer **Update** dans
> Foundry. Le serveur télécharge lui-même l'archive prête à l'emploi (bundle JS + compendiums déjà compilés).
> **Rien à compiler sur OCI**, pas de Node/`npm` à maintenir sur le serveur, pas de conflit Git, pas de verrou LevelDB.

```
 poste de dev                     GitHub                      serveur OCI (Foundry)
 ────────────                     ──────                      ─────────────────────
 npm test / typecheck             Actions « Release »         Setup → Game Systems
 bump version, commit  ──push──▶  tests + build + packs  ──▶  bouton « Update »
 git tag vX.Y.Z        ──push──▶  brigandyne-40k.zip           (lit le manifest)
                                  + system.json
```

Manifest utilisé par Foundry (déjà dans `system.json`) :
`https://github.com/MabinogiCode/brigandyne-40k/releases/latest/download/system.json`

---

## 0. Avant tout : identifier comment Foundry tourne chez toi

Sur le serveur OCI (SSH). Dans les commandes ci-dessous, remplace `foundry` par le nom réel de ton conteneur/service :

```bash
docker ps --format '{{.Names}}\t{{.Image}}'      # Foundry en conteneur (ex. felddy/foundryvtt) ?
systemctl list-units | grep -i foundry            # ou un service systemd ?
pm2 list 2>/dev/null                              # ou PM2 ?
```

Repère ensuite le **dossier de données** (celui qui contient `Data/systems`, `Data/worlds`) :

- Docker : le volume monté sur `/data` (ex. `~/foundrydata`) → `docker inspect <conteneur> | grep -A3 Mounts`
- natif : la valeur `dataPath` de `Config/options.json`.

Puis regarde **comment le système y est installé** :

```bash
ls -la <dataPath>/Data/systems/
```

| Tu vois… | Cas | Suite |
|---|---|---|
| `brigandyne-40k` dossier normal (avec `system.json`) | installé par manifest | **§2 puis §3** |
| `brigandyne-40k -> /home/…/Git/brigandyne-40k` (lien `->`) | ancienne méthode `git pull` | **§1 (migration unique)** puis §3 |

---

## 1. Migration unique : abandonner le lien symbolique git (si tu l'utilisais)

L'ancienne méthode (`git pull` + `npm run build` + `npm run pack` sur le serveur) fonctionne mais oblige à garder Node,
`build-essential`, le module natif `classic-level` et à arrêter Foundry avant chaque `pack`. La release GitHub supprime tout ça.

```bash
# 1. Sauvegarde (voir §2) puis arrêt de Foundry
docker stop foundry            # ou : sudo systemctl stop foundry

# 2. Retirer LE LIEN (jamais le dépôt cloné) : rm sur le lien, sans slash final !
rm <dataPath>/Data/systems/brigandyne-40k

# 3. Relancer Foundry, puis dans l'interface :
#    Setup (écran d'accueil) → Game Systems → Install System → coller le Manifest URL ci-dessus → Install
docker start foundry
```

Les mondes et les personnages ne sont **pas** touchés : ils vivent dans `Data/worlds`, pas dans le dossier du système.
Le dépôt `~/Git/brigandyne-40k` peut ensuite être supprimé (ou gardé pour dépanner, §6).

---

## 2. Sauvegarde (à faire avant CHAQUE mise à jour)

Foundry ne fait pas de sauvegarde automatique. Une mise à jour de système ne modifie pas les mondes, mais **les nouvelles
règles agissent sur tes personnages** (ex. 0.7 : suivi des munitions, blessures graves) : garde un point de retour.

```bash
docker stop foundry            # arrêt propre : évite de copier des bases LevelDB ouvertes
cd <dataPath>
tar czf ~/foundry-backup-$(date +%F).tgz Data/worlds Data/systems Config
docker start foundry
```

Option OCI : instantané du *boot volume* / *block volume* depuis la console (Storage → Block Volumes → Backups) avant une grosse montée de version.

---

## 3. Publier et installer une nouvelle version

### 3.1 Sur ton poste : préparer et publier

```bash
npm ci
npm run typecheck && npm test          # 261 tests : rien ne doit échouer
# 1. version dans system.json ET package.json (identiques) — npm le fait pour package.json :
npm version 0.7.1 --no-git-tag-version   # puis reporter la même valeur dans system.json ("version")
git add -A && git commit -m "release: v0.7.1"
git tag v0.7.1
git push origin main --tags            # le tag déclenche le workflow « Release »
```

Le workflow (`.github/workflows/release.yml`) refuse la release si le tag ne correspond pas à `system.json`, rejoue
typecheck et tests, compile le bundle et les compendiums LevelDB, puis publie `system.json` + `brigandyne-40k.zip`.
Vérifie dans **GitHub → Actions** que le run est vert et que la release contient bien les deux fichiers.

### 3.2 Sur Foundry (OCI) : mettre à jour

1. **Ramener tout le monde à l'écran de configuration** (fermer le monde : *Return to Setup*) ; les joueurs se reconnectent après.
2. **Setup → Game Systems** : le système affiche une mise à jour disponible → **Update**
   (ou **Update All** pour tout mettre à jour d'un coup).
   Sinon : **Install System** → coller le manifest ci-dessus → **Install** (réinstalle par-dessus).
3. Vérifier la version affichée (**0.7.x**), relancer le monde.
4. Chaque joueur : **rechargement forcé du navigateur** (Ctrl+F5) pour ne pas garder l'ancien JS/CSS en cache.

Aucun redémarrage du serveur n'est nécessaire dans ce cas (Docker ou natif).

### 3.3 Vérifier

Voir la **recette manuelle** de [`AUDIT-CONFORMITE.md`](AUDIT-CONFORMITE.md) §9 (10 vérifications, 5 minutes).
Console navigateur (F12) : aucune erreur rouge au chargement du monde.

---

## 4. Retour arrière

- **Rapide** : installer la version précédente via le manifest de son tag :
  `https://github.com/MabinogiCode/brigandyne-40k/releases/download/v0.6.2/system.json` (Install System).
- **Complet** : arrêter Foundry, restaurer l'archive du §2 (`tar xzf … -C <dataPath>`), relancer.

> Attention : une fois un monde ouvert avec une version plus récente, un retour à une version plus ancienne n'annule pas
> les champs ajoutés aux acteurs (compteurs, pertes définitives). D'où la sauvegarde du §2.

---

## 5. Ce que la mise à jour change pour un monde existant

- Les **compendiums** sont remplacés (armes sans munitions parasites, pouvoirs mineurs complets, séquelles RAW, nouveau
  compendium *Équipement & améliorations*…). Les objets **déjà copiés dans des fiches** ne changent pas : pour profiter
  d'une valeur corrigée, remplacer l'objet depuis le compendium.
- **Migration automatique (une seule fois, par le MJ)** : les armes à chargeur des fiches existantes sont remises pleines
  (le suivi des munitions est nouveau ; sans cela elles refuseraient de tirer).
- Les personnages gagnent de nouveaux champs (pertes définitives PV/SF, compteur de pouvoirs mineurs) avec des valeurs
  par défaut neutres ; rien à faire.

---

## 6. Méthode alternative (dépannage / correctif urgent sans release)

À réserver aux cas où tu veux tester un commit avant de le publier. Nécessite Node 22+ et `build-essential` sur le serveur.

```bash
docker stop foundry                     # ou systemctl stop : LevelDB verrouille les packs ouverts
cd ~/Git/brigandyne-40k
git fetch origin && git reset --hard origin/main   # serveur de déploiement : aucune modif locale à garder
git clean -fd packs/
npm ci
npm run build          # dist/brigandyne40k.mjs
npm run pack           # compile packs/_source → packs LevelDB
docker start foundry
```

⚠️ **Ne lance jamais `npm run import`** : l'importeur historique écraserait les compendiums corrigés à la main
(il est désormais bloqué sans `--force`). Les compendiums se modifient dans `packs/_source`.

Première installation par cette méthode : `git clone`, `npm ci`, `npm run build && npm run pack`, puis
`ln -s ~/Git/brigandyne-40k <dataPath>/Data/systems/brigandyne-40k` (mais préfère le manifest, §1).

---

## 7. Dépannage

| Symptôme | Cause probable | Remède |
|---|---|---|
| Pas de bouton **Update** | Le système est un lien symbolique / n'a pas de manifest lisible | §1, ou **Install System** avec le manifest |
| `404` sur le manifest | Le tag n'a pas produit de release (workflow en échec ou en cours) | GitHub → Actions ; corriger puis re-tagger |
| Workflow rouge « tag ≠ system.json » | Version de `system.json` non alignée sur le tag | Aligner `system.json`, commit, supprimer/recréer le tag |
| Foundry affiche l'ancienne version | Cache navigateur | Ctrl+F5 ; vérifier `Data/systems/brigandyne-40k/system.json` |
| Compendiums vides / erreur `LOCK` | Pack copié pendant que Foundry tournait (méthode §6) | Arrêter Foundry, refaire `npm run pack` |
| Armes qui refusent de tirer (« chargeur insuffisant ») | Arme ajoutée avant la 0.7 hors migration | Bouton ↻ (Recharger) sur la ligne de l'arme |
| Erreur au démarrage du monde | Cache ou version de Foundry < 13 | Foundry **v13 minimum** (vérifié en v14) |
