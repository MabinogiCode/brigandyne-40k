# Warhammer 40 000 : Brigandyne — Créer son personnage

*Guide pas-à-pas pour fabriquer un serviteur (ou un renégat) de l'Imperium.*
*Le plus simple : ouvre l'**Assistant de création** dans Foundry (bouton 🪄 en haut du répertoire des Acteurs) — il fait tous les calculs pour toi. Ce guide explique les choix.*

---

## Étape 0 — Le concept (le plus important)

Avant les chiffres, **une phrase** : qui es-tu ? « Une bidasse de la Garde rescapée d'un monde tombé », « un scribe de l'Administratum qui en sait trop », « un repenti qui fuit un culte du Chaos »… Discutez-en en groupe : vous devez avoir une **raison de voyager ensemble** (une cellule d'Inquisition, un équipage, une bande de survivants, un régiment…).

---

## Étape 1 — L'espèce

| Espèce | En deux mots | Spécial | Destin |
|---|---|---|---|
| **Humain** | Polyvalent, tenace, l'épine dorsale de l'Imperium | — | **3** |
| **Squat** | Abhumain trapu, robuste, ingénieur né | Nyctalopie, +1 SF, +1 PV | 2 |
| **Ratling** | Petit, sans-gêne, **tireur d'élite** hors pair | — | 3 |
| **Ogryn** | Colosse simplet, **force** légendaire | +2 PV, Résistance aux maladies | 1 |
| **Mutant** | Marqué par une déviance stable, méprisé | Peut développer des **Mutations** | 2 |
| **Aeldari** | Xenos gracieux, agile, sensible au Warp | Nyctalopie, démarre avec un peu de PSY | 2 |
| **Paria** | Sans écho dans le Warp ; glace les psykers | **Gène du Paria** (ne peut **pas** être psyker) | 1 |

Chaque espèce a des **valeurs de départ** différentes et parfois des **plafonds** (ex. un Ogryn plafonne en Connaissances, un Ratling en Force). L'assistant les applique automatiquement.

---

## Étape 2 — Les caractéristiques

Deux méthodes (l'assistant propose les deux) :

- **Par les dés** (aléatoire, nerveux) : tu lances une volée de d10, tu obtiens **12 valeurs** que tu **répartis** comme tu veux entre tes 12 caractéristiques (le Psychisme se gère à part).
- **Par les points** (maîtrisé) : tu répartis un **pool de points** sur tes caractéristiques (maximum **+20** sur une même caractéristique).

> **Le Psychisme (PSY) démarre à 0.** Pour jouer un **psyker**, tu dois *prélever* des points dans tes autres caractéristiques pour les verser en PSY (et le prélèvement en **Combat compte double**). À la création, PSY est **plafonné à 50**. Un Paria ne peut jamais avoir de PSY.

**Sur quoi miser ?** Quelques repères selon l'archétype :

- **Soldat / tueur** : COM ou TIR, END, FOR, VOL.
- **Psyker** : PSY (évidemment), VOL (pour résister au Warp), CNS.
- **Technoprêtre / pilote / médic** : TEC, CNS, PER.
- **Diplomate / espion / noble** : SOC, PER, DIS, VOL.
- **Éclaireur / survivant** : MOU, SUR, PER, TIR.

### Lire l'échelle des scores

| Score | Niveau |
|---|---|
| 25–30 | Médiocre |
| 35 | Ordinaire (le quidam) |
| 40–45 | Compétent |
| 50–55 | Bon professionnel |
| 60–65 | Très bon |
| 70+ | Excellent à surhumain |

> Rappelle-toi : l'**indice** (bonus) = le chiffre des dizaines. Monter une carac. de 49 à 50 fait gagner +1 d'indice — précieux pour les dégâts, l'Initiative, les PV…

---

## Étape 3 — La carrière

Choisis une carrière dans l'une des grandes institutions (**Adeptus**) :

- **Adeptus Administratum** — scribes, archivistes, logisticiens.
- **Adeptus Arbites** — la loi impériale, brutale.
- **Adeptus Mechanicus** — technoprêtres et leurs serviteurs.
- **Adeptus Ministorum / Adepta Sororitas** — clergé et Sœurs de Bataille (la **Vraie Foi**).
- **Astra Militarum** — la Garde impériale, chair à canon héroïque.
- **Officio Assassinorum** — les tueurs de l'ombre.
- **Scholastica Psykana** — les **psykers** sanctionnés.
- **Civils / Pègre / Mondes féodaux** — tout le reste (et les carrières médiévales de Brigandyne s'adaptent très bien aux mondes arriérés).

La carrière fixe :
- ton **profil de progression** (les compétences que tu pourras monter facilement) ;
- ton **niveau de vie** de départ ;
- tes **spécialités et talents** initiaux ;
- ton **équipement** de départ.

---

## Étape 4 — Atouts de départ

Ta carrière te donne des **spécialités** (+5 à +20 % ciblés) et des **talents** (capacités spéciales). L'assistant les ajoute automatiquement depuis les compendiums. Lis-les : ce sont tes atouts signature.

---

## Étape 5 — Les jauges (calculées pour toi)

| Jauge | Formule | Sens |
|---|---|---|
| **PV (Vitalité)** | `FOR/5 + END/5 + *VOL*` (+ bonus d'espèce) | Ta résistance physique |
| **SF (Sang-froid)** | `VOL/5 + CNS/5 + *COM*` (+ bonus d'espèce) | Ton mental |
| **Initiative** | `*COM* + *MOU* + *PER*` | Qui agit en premier |
| **Destin** | selon l'espèce | Ta corde de rappel face à la mort |
| **Seuil d'instabilité** | `SF/4` | Combien tu perds quand le Warp te ronge |

> Ces valeurs **se recalculent toutes seules** quand tes caractéristiques montent : pas besoin d'y toucher à la main.

---

## Étape 6 — Les finitions

- **Trône Gelt** : ta bourse de départ (la monnaie de l'Imperium).
- **Vices & Vertus** : 1 à 3 traits qui te définissent (Colérique, Loyal, Généreux, Lâche…). Ils rapportent du SF quand tu les joues… et te rendent vulnérable à certains **Dieux Sombres**.
- **Détails** : nom, âge, monde d'origine, allure, motivation. C'est ce qui fait vivre le personnage à la table.

---

## Exemple éclair

> **Kasrkin « Vex », vétéran de la Garde (Astra Militarum), Humain.**
> Méthode par points, profil de tireur : TIR 50, END 45, COM 40, VOL 40, PER 40, le reste autour de 25–35. PSY 0.
> - Indice TIR *5*, FOR *3*.
> - PV = 30/5 + 45/5 + *4* (VOL 40) = 6 + 9 + 4 = **19**.
> - SF = 40/5 + 30/5 + *4* (COM 40) = 8 + 6 + 4 = **18**.
> - Initiative = *4* + *3* + *4* = **11**. Destin **3**.
> - Spécialité « Fusils laser » (+10), Talent « Sang-froid », niveau de vie Pauvre.
> - Vertu : Loyal +1. Vice : Colérique +1 (gare à Khorne…).
> Vex est prête. Pour l'Empereur !

---

### Récapitulatif

1. **Concept** (une phrase, en groupe). 2. **Espèce**. 3. **Caractéristiques** (dés ou points ; PSY à part). 4. **Carrière** (Adeptus). 5. **Atouts**. 6. Les jauges se calculent seules. 7. **Finitions** (Gelt, Vices/Vertus, identité).

> Le plus rapide : laisse l'**Assistant de création** 🪄 dérouler ces étapes pour toi.
