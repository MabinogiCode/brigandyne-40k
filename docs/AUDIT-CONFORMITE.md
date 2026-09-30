# Audit de conformité — Livre Premier + adaptation 40K (v0.7.0)

Audit du système Foundry « Warhammer 40,000 : Brigandyne » face aux sources :

- **Brigandyne 2e édition — Livre Premier** (PDF, numérotation = pages imprimées) ;
- **Warhammer 40.000 : Brigandyne** (adaptation, `.docx`), **Armurerie xeno** et **Rencontres**
  (les trois `.docx` ont été ré-extraits : identiques aux sources déjà importées, aucune dérive).

Chaque écart corrigé est verrouillé par un test ; la suite compte **261 tests** (`npm test`).

## 1. Méthode et limites

| Niveau | Ce qui est vérifié | Fichiers |
|---|---|---|
| Règles pures | Formules du livre (doublé, seuil de blessure, résistance, folie, corruption, munitions, armures…), une règle = un test qui cite la page | `test/combat-rules`, `warp-rules`, `sequelae`, `augmentations` |
| Données | **Chaque ligne** des tableaux du document 40K comparée, champ par champ, au compendium (armes, munitions, armures, véhicules, armements, augmentations, pouvoirs, Actes de Foi, Phénomènes, Périls, espèces, spécialités, bestiaire) | `test/gear-40k`, `powers-40k`, `atouts-40k`, `bestiary-40k` |
| Colle Foundry | Enchaînement réel des jets, dégâts, pouvoirs, Foi, Corruption, Folie, séquelles, chargeurs, cartes de chat, sur un **simulacre** de Foundry | `test/actor-glue`, `chat-glue`, `test/helpers/foundry-mock.ts` |
| i18n | Toute clé `BRIG.…` citée dans le code/les gabarits existe dans `lang/fr.json` | `test/lang-keys` |

**Limite importante** : aucun Foundry n'était disponible pour cet audit. Le simulacre attrape les erreurs de
logique, pas les erreurs d'API Foundry ni le rendu visuel. Une **recette manuelle** (§7) est donc nécessaire
avant de jouer.

## 2. Déjà conforme (vérifié, inchangé)

d100 sous la caractéristique, 6 degrés et exceptions < 20 % / ≥ 80 % (p.130-132) · Avantages/Désavantages ±10, plafond ±3
(p.131) · MODO = 50 − compétence (p.133) · Vitalité, Sang-froid, Initiative, Seuil d'instabilité (p.18/157) · relance 4/6 SF
(p.142) · coup critique explosif (p.161) · dégâts minimums 1 (p.161) · tactiques En force / En finesse / Sur la défensive (p.180) ·
niveaux de vie et régénération (p.141/144) · tableau des salaires 40K · expérience et coûts (p.149-151) · disciplines selon PSY ·
Vices des dieux sombres · **espèces** (valeurs, plafonds, Destin) · Phénomènes psychiques et Périls du Warp (25 + 18 lignes) ·
Actes de Foi (8) · véhicules (30) et leurs armements · armes de mêlée et à distance du document (hors parasites, ci-dessous) ·
Armurerie xeno · augmentations (prix, effets texte).

## 3. Bugs de règles corrigés

| # | Écart constaté | Source | Correction |
|---|---|---|---|
| 1 | **Corruption** : le désavantage par niveau de Vice n'était **jamais** appliqué (le code comparait un dieu à des vices ; l'assistant laissait le champ vide) | 40K Corruption | Vice reconnu par son nom/`viceKey` ; test pour chaque dieu |
| 2 | **Blessures graves** déclenchées à **0 PV**, tirage uniforme dans **8 blessures inventées** | p.196-197 | Déclenchement si une passe d'armes fait perdre ≥ la moitié des PV (premiers rôles) ; d100 sur les **11 lignes du livre** ; pertes définitives ; doublé = armure −1 ; bouton « Appliquer » (choix du joueur) |
| 3 | **Pouvoirs psy** : un seul compteur pour pouvoirs et pouvoirs mineurs ; mineurs soumis à un test ; Résistance de la cible ignorée ; Gêne du Paria absente | p.208-213, 40K | Deux compteurs (*PSY* pouvoirs + *PSY* mineurs) ; mineurs automatiques ; MODO de la cible si plus difficile ; Paria (Désavantage à < 20 m, +10 % au Warp) ; échec critique −1 SF ; **Forcer le Warp** 1×/jour |
| 4 | **Pénalité d'armure au MOU** calculée mais jamais appliquée ; Init des armes ignorée | 40K Armures / p.183 | Appliquée aux tests (MOU, PER du casque) et à l'Initiative |
| 5 | **Synthéderme « 4/+2 » et Combinaison composite « 2/+1 »** comptés en plein sous une armure | 40K Armures | Champ `underBonus` : valeur seule, bonus réduit sous une autre armure |
| 6 | **Véhicules** : immunité totale aux armes normales | 40K Véhicules, Livre 2 p.115 | Résistance = dégâts ÷2 (solide, Bolt, laser) ; vaisseaux immunisés ; arme de véhicule ×2 sur cible humaine ; Percuter ; Course-poursuite ; pilotes insuffisants |
| 7 | **Sang-froid** : `sfForAdvantage`/`sfBonusPercent` n'existaient que comme constantes | p.142 | Case « 2 SF = 1 Avantage » dans le dialogue de test |
| 8 | **Folie** absente : pas de test −2/−4/−6, pas de perte définitive, pas de crise | p.143, 174-177 | Bouton *Folie* ; SF à 0 → crise (perte définitive = ¼ du SF de base, constante) ; personnage fou ; Corruption : choix crise ou mutation (D10 pair = Grâce) |
| 9 | **Destin** : pas de dépense définitive ni de survie in extremis | p.147 | Bouton *Destin définitif* (−1 courant et de départ, 1 PV, refusé à 0) |
| 10 | **Armes 40K** : chargeurs, semi-auto/rafale, Viser, Surchauffe, Destruction, Couvert, portée, Décupleur, Risquée, doublé — décrits mais non appliqués | 40K Armes/Armures, p.183 | Tous appliqués (voir §4) |
| 11 | **Vraie Foi** : conditions d'accès, prière, « sourd RU heures » non gérés | 40K Vraie Foi | Éligibilité (Vertu ou Colérique +2 ou case cochée), durée de prière, carte « sourd » sur E+ |
| 12 | **Augmentations** : limite *VOL* et effets chiffrés non gérés | 40K Augmentations | Compteur, plafond (Cyberchape ×2, esthétiques exclues), effets automatiques (FOR, MOU, END, SOC, PV, Protection, tests) |
| 13 | Dégâts pairs (feu, froid, électrique, psychique) et acides sans effet | p.135 | Statuts Enflammé/Ralenti/Sonné/Confus ; acide −1 armure |
| 14 | Tactique **Viser** : malus fixe −10 | p.180 | −5/−10 selon l'armure, casque et bouclier −5 chacun (max −20) ; Sur la défensive +3 avec bouclier ; Attaques multiples |
| 15 | Clé i18n `BRIG.Warn.noSf` absente ; libellés vides des grilles espèce/carrière | — | Ajoutés (nouveau test i18n) |

## 4. Armes à distance (40K) — comportement implémenté

| Spécificité | Comportement |
|---|---|
| Chargeur | Le compteur baisse à chaque tir (personnages) ; vide → « rechargez » ; **Recharger** : en combat les munitions restantes sont perdues, hors combat non ; *Chargement (X)* affiché |
| Automatique / Semi-auto / Rafale | Menu dans le dialogue de tir ; semi : 1 Désavantage, 2 munitions par tir ; rafale : 1 Désavantage, **dégâts ×2**, moitié du chargeur |
| Viser | +1 Avantage (+2 avec Viseur) — case « visée » du dialogue |
| Lourde / Précis | Désavantage si FOR < 50 / toujours 1 Avantage |
| Portée | Désavantage au-delà de la portée effective (si les deux jetons sont sur la scène) |
| Couvert (X) | X Désavantages au tireur si la cible porte le bouclier (sauf arme « Ignore boucliers ») |
| Surchauffe | Sur échec majeur/critique : bouton « Surchauffe » — le tireur subit les dégâts de l'arme sans le RU |
| Destruction / acide | Chaque coup au but ôte 1 point à la meilleure armure de la cible |
| Décupleur | Armure énergétique : +10 % aux tests de FOR/END, +1 dégât de mêlée |
| Risquée | Sur un doublé, le porteur encaisse son *FOR* |

## 5. Données corrigées (compendiums)

`npm run import` **n'est plus fiable** : il régénère 80 fichiers différents des packs actuels (carrières « 10+10 »,
etc.). Les corrections sont donc faites **dans `packs/_source`** (source de vérité) et l'importeur est **bloqué par défaut**
(`--force` requis). Deux scripts sûrs ont été ajoutés : `npm run import:equipment`, `npm run import:sequelae`.

| Compendium | Correction |
|---|---|
| Armes | **26 entrées parasites supprimées** (munitions, chargeurs, viseurs… importés comme « armes » à cause d'une plage de tableau trop large, ex. « Silencieux : +15, chargeur 30 ») ; Fléau d'armes Init −1 ; Lance-flammes = feu ; armes électriques = électrique ; Grenade Psy = psychique ; portée des explosifs ; Point faible |
| Armures | Cotte de mailles Init −3 ; écu MOU −5 % ; casque médiéval PER −5 % (et non MOU) ; Couvert et Décupleur en qualités ; « X/+Y » ; **Armure de plates alourdie** et **Pavois** ajoutés (p.192) |
| Pouvoirs psy | **26 pouvoirs mineurs créés** (n'existait qu'un mineur par domaine, dont la description fusionnait tous les autres) ; 7 descriptions réparées ; formules et types de dégâts de 9 pouvoirs ; fautes « M0yenne », « Courtes » |
| Spécialités | Astrogation +20 ; Vraie Foi occulte +5 ; Fusil de précision et Artillerie martiaux +5 ; **Arme lourde** ajoutée ; caractéristique testée et effet pour les 21 spécialités 40K (un test de spécialité utilisait TEC pour tout) |
| Bestiaire | L'**Horreur Rose** (COM 40, PV 13) manquait : l'entrée existante était en fait l'**Horreur Bleue** (erreur de copier-coller du document) |
| Blessures graves | 8 entrées « Exemple » → **11 lignes RAW p.197** |
| Équipement | **Nouveau compendium** (107 objets, 12 dossiers) : listes de prix, drogues avec leurs effets, améliorations d'armes/armures, services |

## 6. Interprétations à valider (la source est ambiguë)

Chaque point est un réglage isolé, facile à changer ; dites-moi si vous tranchez autrement.

1. **Semi-automatique** : « chaque tir consomme 2 munitions » → 2 munitions **par test** (4 par tour). **Rafale** : « la moitié totale de ses munitions » → la moitié de la **capacité** du chargeur.
2. **Ignore boucliers** annule aussi le Couvert du bouclier.
3. **Gêne du Paria** : « à proximité » = **20 m** (`BRIGANDYNE.mechanics.pariaRange`) ; un pouvoir mineur près d'un Paria demande un test.
4. **Forcer le Warp** : complication mineure ↔ Phénomène psychique ; majeure ↔ Péril du Warp (règle 40K).
5. **Blessure grave** : « PV perdus » = dégâts encaissés après armure, premiers rôles seulement.
6. **Crise de folie** : appliquée automatiquement quand le SF tombe à 0 (par le système) ; l'Instabilité reste ¼ du SF de base d'origine (18 → 4, 4, 4… comme dans l'exemple p.176).
7. **Résistance des véhicules** : dégâts ÷2, arrondi inférieur, avant l'armure.
8. **Init des armes** : seule l'arme équipée la plus encombrante compte ; le bouton « main » de la fiche équipe une arme.
9. **Salaire** : la source ne dit pas quelle compétence tester ; le système garde SOC (base 50).
10. **Armes électriques** : dégâts électriques (Sonné sur total pair) ; « ignore les armures métalliques » n'est pas modélisé (pas de matériau sur les armures).

## 7. Non automatisé / hors périmètre (assumé)

- **Grâces et Fardeaux** : le document renvoie au **Livre Second** (non fourni) ; le compendium *Mutations* contient des exemples non officiels.
- Rituels et actions longues, ivresse, maladies et poisons (tables), apprentissage/entraînement, familiers, Certamen.
- Coup tordu (chifoumi), attaques d'opportunité, surnombre : décisions du MJ (Avantages saisis à la main).
- Souffle (X) et Rayon (X) : les dégâts s'appliquent à **toutes les cibles ciblées** ; choisir les cibles reste au MJ.
- Améliorations d'armes (Viseur, Équilibrée…) : objets du compendium *Équipement* à reporter à la main sur l'arme (qualité Viseur, etc.).
- Armes médiévales (mondes féodaux) : sous-ensemble du livre (35 armes), non exhaustif.

## 8. Anomalies du document source (à corriger dans le `.docx` si vous le souhaitez)

« M0yenne » (Projectile de force) · « Courtes » (Ébullition) · **Horreur Rose** dupliquée (2ᵉ bloc = Horreur Bleue) ·
« Poing faible » (Lame de poing → *Point faible*) · « Fusil à aguilles » · « Dissipation d'ivresse » listée dans
la Biomancie mais non décrite (le tableau détaillé donne « Vision nocturne ») · Épée courte de force : allonge E
(l'épée courte est C) · description de Désagrément légèrement différente entre Générique et Télépathie.

## 9. Recette manuelle Foundry (avant de jouer)

1. Ouvrir un monde, vérifier la bannière de version **0.7.0** et l'absence d'erreur en console (F12).
2. Ouvrir une fiche existante : PV/SF corrects, boutons **Folie** et **Destin définitif** présents, compteurs Pouvoirs/Mineurs/Actes.
3. Glisser un **Bolter** du compendium : le chargeur affiche 16/16 ; tirer en rafale : le dialogue propose le mode, le chargeur baisse de 8.
4. Attaquer une cible avec bouclier : 1 Désavantage (Couvert) ; avec un Bolter : aucun.
5. Lancer un **pouvoir mineur** : carte automatique, compteur Mineurs +1 ; un pouvoir normal : test de PSY.
6. Infliger ≥ la moitié des PV d'un PJ en un coup : carte **Blessure grave** ; « Appliquer » (choix si « au choix du joueur »).
7. Un blindé encaisse un tir de bolter (÷2) ; un vaisseau ne prend rien ; un canon de véhicule double sur un humain.
8. Test de **Corruption** contre Khorne avec un personnage Colérique : 1 Désavantage.
9. Ouvrir le compendium **Équipement & améliorations** et **Armes** (plus de « Viseur » ni de « Balle M » parmi les armes).
10. Vérifier qu'un personnage existant avec une arme à chargeur a été **rechargé** par la migration (message unique du MJ).
