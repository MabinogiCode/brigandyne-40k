# Warhammer 40 000 : Brigandyne — Aide de jeu du joueur

*Résumé des règles à garder sous la main. Système « Chair & Sang » : rapide, mortel, grimdark.*
*« Dans l'obscurité du futur lointain, il n'y a que la guerre. »*

---

## 1. Le dé : tout se joue au d100

On lance **1d100** et on compare au score de la **compétence** testée (notée sur 100).

- **Résultat ≤ score → réussite.**
- **Résultat > score → échec.**

C'est tout. Pas de calcul compliqué : si tu as 45 en Tir, tu réussis sur 01–45.

> **00 compte comme 100** (donc presque toujours un échec retentissant).

### Les 6 degrés de réussite

Le degré dépend des **chiffres** du résultat :

| | Réussite (≤ score) | Échec (> score) |
|---|---|---|
| **Critique** | le chiffre des **unités = 0** (ex. 10, 20, 30…) | unités = 0 |
| **Majeur(e)** | résultat **01–09** | résultat **91–99** |
| **Mineur(e)** | tout le reste | tout le reste |

- **Réussite majeure / critique = R+** : tu réussis *et* tu obtiens un bonus (un avantage narratif, un effet spécial, etc.).
- **Échec majeur / critique = E+** : tu rates *et* il y a une complication.

> **Deux exceptions « de talent »** :
> - Si tu as **moins de 20 %** de réussir, tu ne peux **pas** faire de réussite majeure (juste mineure… ou critique si le sort s'en mêle).
> - Si tu as **80 % ou plus**, tu ne peux **pas** faire d'échec majeur (juste mineur… ou critique).

### Le RU (Résultat des Unités)

Le **chiffre des unités** de ton jet. Il sert partout : **dégâts**, durée des pouvoirs, etc. Un 47 a un RU de 7.

---

## 2. Difficulté, Avantage, Désavantage

**La difficulté** est un modificateur que le MJ ajoute à ton score avant le jet :

| Triviale | Simple | Aisée | Faisable | Test sec | Difficile | Ardue | Complexe | Infaisable |
|---|---|---|---|---|---|---|---|---|
| +40 | +30 | +20 | +10 | **0** | −10 | −20 | −30 | −40 |

Le **« test sec »** (difficulté 0) est déjà *exigeant* : on agit dans le stress, sans préparation.

**Avantage / Désavantage** : chaque **Avantage = +10**, chaque **Désavantage = −10**. Ils s'annulent entre eux, et on en cumule **3 maximum** (donc ±30 au plus). On en gagne grâce à : du temps, du bon matériel, une carrière qui colle, une bonne idée, du beau roleplay… ou l'inverse pour les Désavantages.

---

## 3. Oppositions (toi contre quelqu'un)

Quand tu affrontes un adversaire (bras de fer, filature, **combat**…), **toi seul lances le dé**. Le score adverse devient une **difficulté** appelée **MODO** :

> **MODO = 50 − compétence de l'adversaire**

- Adversaire faible (compétence < 50) → MODO **positif** → bonus pour toi.
- Adversaire fort (compétence > 50) → MODO **négatif** → malus pour toi.
- À égalité de niveau, chacun a 50 % de gagner.

Si tu réussis, tu gagnes l'opposition ; si tu rates, c'est l'adversaire qui l'emporte.

---

## 4. Le personnage en bref

### 13 caractéristiques (notées sur 100)

| | | |
|---|---|---|
| **COM** Combat | **CNS** Connaissances | **DIS** Discrétion |
| **END** Endurance | **FOR** Force | **TEC** Technique *(bricolage, soins, pilotage)* |
| **PSY** Psychisme *(pouvoirs du Warp — démarre à 0)* | **MOU** Mouvement | **PER** Perception |
| **SOC** Sociabilité | **SUR** Survie | **TIR** Tir |
| **VOL** Volonté *(sang-froid, commandement, Foi)* | | |

> **L'indice** (ou « bonus ») d'une caractéristique = son **chiffre des dizaines**. FOR 45 → indice **4**. On le note `*FOR*`.

### Les jauges et ressources

- **PV (Vitalité)** = `FOR/5 + END/5 + *VOL*`. À **0 PV**, tu es hors-combat (blessure grave !).
- **SF (Sang-froid)** = `VOL/5 + CNS/5 + *COM*`. Ton mental. À **0 SF**, crise de folie.
- **Initiative** = `*COM* + *MOU* + *PER*`. Ordre d'action en combat.
- **Destin** : 1 à 3 points selon l'espèce. La ressource la plus précieuse (voir §8).
- **Corruption** : ta souillure par le Chaos. Le **Seuil d'instabilité** = `SF/4`.

*(Ces jauges évoluent automatiquement quand tes caractéristiques montent.)*

### Atouts

- **Spécialités** : un bonus de **+5 à +20 %** sur une action précise (« Pistolets », « Crochetage », « Intimidation »…).
- **Talents** : capacités spéciales qui donnent du style (botte secrète, contact, sens aiguisé…).

---

## 5. Sang-froid : ton meilleur ami (et ton talon d'Achille)

Le **Sang-froid (SF)** se dépense pour te dépasser (**bon stress**) et se perd sous les chocs (**mauvais stress**).

**Dépenser du SF :**

| Coût | Effet |
|---|---|
| **−2 SF** | +1 Avantage (avant le jet) |
| **−2 SF** | Ignorer un handicap pour ce tour |
| **−4 SF** | **Relancer** un test (le nouveau résultat est conservé) |
| **−6 SF** | Relancer un **échec critique** |

**Perdre du SF** : peur, violence, humiliation, abattement → le MJ demande un **test de VOL (test de Folie)**. Échec = perte de SF (2 / 4 / 6 selon la gravité).

À **0 SF** : crise de folie, le MJ prend le contrôle un moment, et ta limite de SF baisse définitivement.

**Regagner du SF** : repos selon ton niveau de vie, réconforter/être réconforté, bien manger, faire la fête, prier, et surtout… **du bon roleplay** (le MJ récompense les bonnes idées et les belles scènes).

---

## 6. Combat

Le temps se découpe en **rounds de 10 secondes**. On agit par **Initiative décroissante**. On fait **une action significative** par tour. Une fois engagé au corps-à-corps, on ne peut que **combattre** ou **se désengager**.

### Mêlée = un seul jet opposé COM/COM

Tu lances **un** d100 contre le **MODO de Combat** de l'adversaire. Le gagnant « prend le dessus » :

- **Réussite mineure** → **1 effet** : Blesser, Bousculer (mise à terre) ou Désengager.
- **Réussite majeure** → **2 effets** cumulés.
- **Réussite critique** → 2 effets **ou** un **coup critique** (10 dégâts + le dé « explose »).

> *Effet miroir* : si **tu** rates, c'est l'adversaire qui prend le dessus et peut te blesser.

### Distance = test de Tir normal

Pas d'opposition : un **test de TIR**, difficulté 0 par défaut (la cible bouge). Tirer sur un ennemi au contact d'un allié = 1 Désavantage (et sur un E+, tu touches ton allié !).

### Les dégâts

> **Dégâts = dégâts de l'arme + RU**, puis on **retranche la Protection** de la cible.

- Arme de mêlée : basée sur ta **Force** (`*FOR*` ± selon l'arme : mains nues −3 → arme lourde +2).
- Arme à distance mécanique (laser, bolter, fusil…) : **dégâts fixes**.
- **Minimum 1 dégât** si tu blesses, même à travers l'armure.
- **Armures** : protection de 1 à 4. Casque **+1**, bouclier **+2**. Certaines armes **percent** ou **ignorent** l'armure ; les armes à feu lourdes ignorent la **moitié** de l'armure.

### Tactiques de combat (premiers rôles)

Une seule par round : **Efficace** (standard) · **En force** (−1 Désav., +*FOR* dégâts) · **En finesse** (+1 Avantage, dégâts ÷2) · **Sur la défensive** (+2 Avantages, 0 dégât ; +3 avec bouclier) · **Viser** (malus, ignore l'armure).

### Quelques avantages de situation

Surnombre, meilleure position (ennemi à terre, surplomb…), adversaire désarmé : **+1 Avantage** chacun. Attaque surprise : +1 Avantage, attaque sans risque et +2 dégâts.

---

## 7. Dégâts, blessures, soins

- **Premiers soins** (test de TEC) : rend `*END*` PV, une seule fois par source de blessure.
- **Repos** : tu récupères des PV/SF selon ton **niveau de vie** (de Misérable à Royal). Dormir au chaud après un bon repas, ça compte !
- **0 PV** : tu agonises (`*END*` rounds pour te soigner), tu es capturé, ou tu meurs — au choix du MJ. Tu peux gagner une **blessure grave** permanente.
- **Poisons & maladies** : test d'**END** (la difficulté = la « virulence »).

---

## 8. Le Destin : échapper à la mort

Les **points de Destin** sont rares et puissants. Ils servent à **deux** choses :

1. **Coup de pouce narratif** (1 point) : « j'avais justement pris ma corde », « une vieille connaissance passe par là »… (validé par le MJ).
2. **Échapper à la mort** (1 point, **définitif**) : tu survis in extremis à 1 PV. Ton score de Destin max baisse de 1.

> Le Destin **se recharge à chaque scénario**. Garde toujours 1 point en réserve… au cas où.

*(Note : la **relance** d'un jet se paie en **Sang-froid**, pas en Destin.)*

---

## 9. Psykers : le pouvoir du Warp

Le **Psychisme (PSY)** remplace la magie. Trois types de manifestations :

- **Pouvoirs mineurs** : gratuits, automatiques.
- **Pouvoirs** : un **test de PSY** (modifié par la difficulté du pouvoir).
- (Rituels : action longue.)

**Limite** : `*PSY*` pouvoirs par jour. Au-delà, tu puises dans ta **Vitalité** (douloureux). Tu connais **1 à 5 disciplines** selon ton PSY (Biomancie, Divination, Pyromancie, Télékinésie, Télépathie + Générique).

**Quand ça tourne mal** :
- **Échec majeur → Phénomène psychique** (manifestation étrange et gênante).
- **Échec critique → Péril du Warp** (de la simple brûlure… à l'invocation d'un démon ou pire).

> Manier le Warp attire le regard des **Dieux Sombres**. Voir §11.

---

## 10. La Vraie Foi (fidèles de l'Empereur)

Réservée aux personnages **vertueux et non corrompus** (Sœurs de Bataille, Ministorum…). On manifeste un **Acte de Foi** par un **test de VOL** après 2 tours de prière (3 pour un **Miracle**). Limite : `VOL/2` Actes par jour.

Bonne nouvelle : **rater un Acte de Foi n'a rien de cataclysmique** — l'Acte ne se manifeste simplement pas.

---

## 11. Corruption du Chaos

Au contact du Warp, des démons, des reliques chaotiques… tu fais un **test de résistance** (VOL **ou** FOR, au choix). En cas d'échec, tu perds des points de SF égaux à ton **Seuil d'instabilité**.

> Tes **Vices** te trahissent : un personnage Colérique résiste moins bien à **Khorne**, un Gourmand à **Nurgle/Slaanesh**, etc. (1 Désavantage par niveau de Vice concerné.)

Si la corruption te fait tomber à 0 SF, tu peux **éviter la folie**… en acceptant une **mutation** (une Grâce, ou un Fardeau). L'Imperium ne pardonne pas la mutation.

---

## 12. Progression (entre les scénarios)

Tu gagnes des **Points d'Expérience (PX)** : ~50 à 150 par scénario, selon la mission, ton roleplay et tes hauts faits.

| Pour amener une compétence à… | Coût |
|---|---|
| ≤ 50 | 100 PX |
| 51–60 | 150 PX |
| 61–70 | 200 PX |
| 71–80 | 250 PX |
| 81–90 | 300 PX |
| 91–100 | 350 PX |

- Une amélioration = **+5 %**. Ta **carrière** limite les compétences faciles à monter ; hors profil, c'est **+50 PX**.
- **Spécialité ou Talent** : 100 PX (150 si hors-carrière).

---

### Mémo express

> 🎲 **d100 sous la carac.** · unités = 0 → critique · 01–09 majeure · 91–99 majeur
> ➕ **Avantage = +10**, max ±30 · **MODO = 50 − carac. adverse**
> ⚔️ **Dégâts = arme + RU − Protection** (min 1) · mêlée = opposition COM/COM
> 🧠 **−4 SF pour relancer** · 🍀 **Destin** = coup de pouce / survie
> 🔮 PSY : échec majeur = Phénomène, échec critique = **Péril du Warp**

*Pour l'Empereur !*
