# Cahier des charges — App de budget par enveloppes

Version 1.1 — 21.09.2026 — **points ouverts réglés, en attente du feu vert**

---

## 1. Objectif

Une petite application personnelle sur téléphone qui permet de savoir **en quelques secondes combien je peux encore dépenser**, enveloppe par enveloppe.

Principe central : **plafond → dépenses → reste.**

L'app sert de référence pour décider d'une dépense, à la place du solde bancaire.

### Principes non négociables

1. **Coût : 0 CHF.** Pas d'abonnement, de serveur, d'API payante ni de base de données en ligne.
2. **Local / offline-first.** Les données restent sur le téléphone et l'app fonctionne sans réseau.
3. **L'app ne touche jamais à l'argent.** Elle reflète ce que je fais et ce que j'ai réservé. Elle ne prétend jamais qu'un virement a eu lieu : elle propose et rappelle, c'est moi qui agis et qui confirme.
4. **Petite mais excellente.** Pas de fonctionnalité superflue, pas de jargon financier.

---

## 2. Organisation de l'argent

| Compte | Contient |
|---|---|
| **Compte courant** | Revenus, argent des enveloppes mensuelles |
| **Compte épargne** | Épargne + argent réservé des cagnottes |

**Ordre permanent (réglé une fois à la banque) :** chaque début de mois, virement du courant vers l'épargne de **épargne fixe + contributions des cagnottes**. L'app considère ce virement comme **fait chaque mois**.

---

## 3. Les enveloppes

### 3.1 Deux types seulement

| | **Mensuelle** | **Cagnotte** |
|---|---|---|
| Usage | Argent dépensé dans le mois | Argent économisé sur plusieurs mois pour un achat |
| Où est l'argent | Compte courant | Compte épargne |
| Le 1er du mois | Repart à son plafond | Reçoit sa contribution mensuelle, sans remise à zéro |
| Maximum | — | Optionnel. Au-delà, le surplus devient de l'épargne (simple changement d'étiquette, l'argent est déjà sur le compte épargne) |
| Fin du mois | Le reste est **proposé** pour l'épargne dans le bilan | Le solde reste dans la cagnotte |
| Dépense | Payée depuis le courant | L'app **rappelle** de retirer le montant de l'épargne vers le courant |

**Règle de classement :** si c'est payé avec l'argent du mois → mensuelle ; si ça demande d'économiser plusieurs mois → cagnotte.

### 3.2 Dépassement

Autorisé, jamais bloquant. Le reste s'affiche **en négatif, en rouge**. Un dépassement réduit d'autant le reste proposé pour l'épargne en fin de mois.

### 3.3 Configuration de départ (modifiable à tout moment dans ⚙️)

| Enveloppe | Type | Montant/mois | Maximum | Mémo |
|---|---|---|---|---|
| Parachute | mensuelle | 500 | — | Sauts, licence, frais sur place |
| Social | mensuelle | 100 | — | Avec les potes : soirées, bar, restos, sorties |
| Copine | mensuelle | 100 | — | Avec elle : restos, sorties, petites attentions |
| Conso | mensuelle | 100 | — | Conso |
| Essence/parking | mensuelle | 100 | — | Voiture |
| Quotidien | mensuelle | 135 | — | Pour moi : snacks, repas du mardi, station-service |
| Repas | cagnotte | 140 | 470 | Achat groupé des repas (~48 repas) |
| Plaisirs | cagnotte | 108 | 500 | Gros achats et gros cadeaux prévus |
| *Épargne fixe* | — | 300 | — | Dans l'ordre permanent |
| **Total** | | **1'583** | | Revenus : 918.45 + 665 = 1'583.45 |

> Ces montants sont des **estimations de départ**, à ajuster après un ou deux mois grâce à l'historique.
> Ils ne sont **pas écrits dans le code** : ils sont saisis au premier lancement.

---

## 4. Fonctionnement mensuel

- **Mois = mois calendaire** (du 1er au dernier jour).
- **Revenus :** préremplis chaque mois (salaire, aide parentale) et **confirmés d'une touche** sur l'accueil, avec un montant modifiable. Un revenu non confirmé n'est pas compté.
- **Le 13e salaire** n'est pas géré comme un revenu. Il va directement sur l'épargne et se note comme un **« Ajout à l'épargne »**.
- **Plafonds par mois :** si je modifie un plafond, le changement s'applique au mois en cours et aux suivants. Les mois passés gardent leurs anciens plafonds.

### 4.1 Bilan de fin de mois

À la première ouverture d'un nouveau mois, une carte **« Bilan de [mois] »** s'affiche sur l'accueil :
- le reste de chaque enveloppe mensuelle, dépassements déduits, plus l'argent non attribué ;
- le **montant proposé** pour l'épargne (jamais négatif) ;
- trois choix :
  - **« J'ai mis X CHF de côté »** : X est prérempli et modifiable ;
  - **« Ignorer »** : rien n'est viré, l'argent reste sur le compte courant et n'est pas reproposé ;
  - **« Plus tard »** : la carte reste affichée.

Seul le montant **confirmé** est ajouté à l'épargne.

### 4.2 Épargne

- **Épargne** = argent à garder. **Réservé** = soldes des cagnottes.
- Mouvements possibles :
  - épargne fixe mensuelle (automatique, via l'ordre permanent) ;
  - bilan confirmé ;
  - surplus de cagnotte au-delà de son maximum ;
  - **« Ajout à l'épargne »** (13e salaire, argent reçu…) ;
  - **« Retrait d'épargne »** (imprévu) : l'argent repasse sur le compte courant et apparaît comme non attribué.

### 4.3 Vérifier mon solde

Je saisis le solde affiché par ma banque (courant et/ou épargne). L'app le compare à son propre calcul :
- **Identique** → ✅.
- **Écart** → « 23 CHF de différence : une dépense oubliée ? ». Je peux alors ajouter la dépense manquante ou enregistrer un **ajustement**.

---

## 5. Écrans

### 5.1 Accueil
```
┌──────────────────────────────┐
│ ‹  Septembre 2026  ›      ⚙️ │
│                              │
│     Disponible ce mois       │
│          412 CHF             │
│ Courant 890 · Épargne 1'240  │
│ Ordre permanent 548 par mois │
├──────────────────────────────┤
│ Parachute  ██████░░░░   210  │
│ Social     ████████░░    68  │
│ Copine     ██████████   -12 🔴│
│ Conso      ███░░░░░░░    71  │
│ Essence    █████░░░░░    45  │
│ Quotidien  ██████░░░░    52  │
│ ─ Cagnottes · 496 sur l'ép. ─│
│ Repas            280 / 470   │
│ Plaisirs         216 / 500   │
│                              │
│                        [ + ] │
└──────────────────────────────┘
```
- **Grand chiffre :** « Disponible ce mois » = somme des restes des enveloppes mensuelles.
- **Ligne secondaire :** solde courant, épargne, puis le **montant de l'ordre permanent** à virer chaque mois (épargne fixe + contributions des cagnottes). Le total des cagnottes est rappelé dans le titre de leur section.
- Les cartes **Revenus à confirmer** et **Bilan** s'affichent en haut quand c'est nécessaire.
- **‹ Mois ›** permet de naviguer dans les mois passés, sur les mêmes écrans, qui restent modifiables. On ne peut pas aller au-delà du mois en cours.
- Toucher une enveloppe ouvre son détail. Toucher la ligne Épargne ouvre l'écran Épargne.

### 5.2 Ajouter une dépense (action la plus fréquente)
Accessible par le bouton **[ + ]** de l'accueil ou depuis une enveloppe, où celle-ci est alors présélectionnée.
1. **Montant** : pavé numérique affiché immédiatement.
2. **Enveloppe** : grille de boutons.
3. **Note** : **obligatoire** (ex. « soirée »). Sans elle, l'historique devient illisible au bout de quelques mois.
4. **Date** : aujourd'hui par défaut, modifiable d'une touche.
5. **Valider.**

Objectif : **moins de 5 secondes**, sans jamais quitter l'écran.
Pour une cagnotte, un rappel s'affiche après validation : « Pense à virer X CHF de l'épargne vers le courant. »

### 5.3 Détail d'une enveloppe
- **Mensuelle :** reste en grand, barre de progression, « dépensé X sur Y », mémo, puis la liste des dépenses du mois.
- **Cagnotte** (écran volontairement dépouillé, tout y est prévisible) : « Prochain achat : 280 / 470 », barre, **« Possible dès décembre »** ou « Tu peux racheter maintenant », « +140 par mois · sur le compte épargne », puis la liste de **tous** les achats, pas seulement ceux du mois.
- Toucher une dépense permet de la **modifier** ou de la **supprimer**.
- Bouton [ + ].

### 5.4 Épargne
- **En grand : l'argent au chaud** = compte épargne − cagnottes. C'est l'épargne à laquelle je ne touche pas. Le même chiffre est rappelé sur l'accueil.
- En dessous : le détail des cagnottes, puis le total du compte épargne.
- **Ordre permanent** : total à virer chaque mois et détail ligne par ligne (épargne fixe + chaque cagnotte).
- Historique des mouvements.
- Boutons « Ajout à l'épargne » et « Retrait d'épargne ».

### 5.5 Réglages ⚙️
- **Enveloppes :** créer, renommer, modifier le type, le montant, le maximum et le mémo, réordonner.
  - Supprimer n'est possible que pour une enveloppe sans dépenses. Sinon, elle est **archivée** : masquée, mais son historique est conservé.
- **Revenus :** modèle mensuel (nom et montant).
- **Épargne fixe :** montant.
- **Vérifier mon solde.**
- **Données :** exporter / importer (fichier `.json`).
- **Rappel :** si je modifie l'épargne fixe ou la contribution d'une cagnotte, l'app affiche : « Pense à modifier ton ordre permanent : nouveau total X CHF. »

### 5.6 Premier lancement
Assistant en 3 étapes :
1. Soldes actuels du compte courant et du compte épargne, et solde de départ de chaque cagnotte (0 par défaut).
2. Revenus mensuels.
3. Enveloppes : création avec type, montant et maximum.

### 5.7 Apparence
- Thème **automatique** (clair ou sombre selon le réglage du téléphone).
- Montants au format suisse : `1'583.45 CHF`.
- Interface en français, pensée pour une main et un pouce.

---

## 6. Règles de calcul

Tous les montants sont stockés en **centimes (entiers)** pour éviter les erreurs d'arrondi.

**Mois de départ** (celui du premier lancement) : pas de revenus à confirmer ni d'ordre permanent, puisque les soldes saisis ce jour-là en tiennent déjà compte. Une dépense datée d'avant le premier lancement compte dans son enveloppe, mais pas dans les soldes des comptes.

- **Reste d'une mensuelle (mois M)** = plafond(M) − dépenses(M).
- **Disponible ce mois** = Σ restes des mensuelles(M).
- **Cagnotte, début du mois M :** solde = solde fin(M−1) + contribution. Si un maximum existe et que le solde le dépasse, l'excédent est ajouté à l'épargne et le solde est ramené au maximum.
- **Cagnotte, fin du mois M :** solde début(M) − dépenses(M). Le solde peut être négatif.
- **Non attribué (M)** = revenus confirmés(M) − Σ plafonds des mensuelles(M) − épargne fixe − Σ contributions des cagnottes.
- **Montant proposé au bilan (M)** = max(0, Σ restes des mensuelles(M) + non attribué(M)).
- **Compte courant** = solde de départ + revenus confirmés − dépenses des mensuelles − ordres permanents − bilans confirmés + retraits d'épargne ± ajustements.
- **Compte épargne** = solde de départ + ordres permanents + bilans confirmés + ajouts − retraits − dépenses des cagnottes ± ajustements.
- **Épargne** = compte épargne − Σ soldes des cagnottes.
- **Modification d'un mois passé :** tout est recalculé, sauf le montant de bilan confirmé, qui correspond à un vrai virement. Si le reste du mois change après confirmation, l'app affiche l'écart.

---

## 7. Architecture technique

| Élément | Choix | Pourquoi | Coût |
|---|---|---|---|
| Type d'app | **PWA** installable (écran d'accueil) | Pas d'App Store, un seul code | 0 |
| Langage | **TypeScript** | Fiabilité des calculs d'argent | 0 |
| Framework UI | **Svelte 5 + Vite** | Léger, rapide, peu de code | 0 |
| Stockage | **IndexedDB** via **Dexie.js** + `navigator.storage.persist()` | Local, fiable, sans serveur | 0 |
| Offline / installation | **vite-plugin-pwa** (service worker Workbox) | Fonctionne sans réseau | 0 |
| Tests | **Vitest** sur le moteur de calcul | L'argent ne supporte pas les bugs | 0 |
| Hébergement | **GitHub Pages** (dépôt public, fichiers statiques, HTTPS) | Gratuit, HTTPS requis pour une PWA, déjà familier | 0 |
| Cible | **iPhone, Safari** (installation : Partager → « Sur l'écran d'accueil ») | Téléphone utilisé | 0 |

- **Aucune donnée personnelle ne quitte le téléphone.** Le serveur ne fournit que les fichiers de l'app.
- **Aucun montant personnel dans le code**, qui peut donc être public sans risque.
- **Sauvegarde :** export et import manuels d'un fichier JSON versionné, avec vérification à l'import.

### Modèle de données (simplifié)
```
Envelope      { id, name, type: 'monthly'|'pot', memo, order, archived, maxCents? }
EnvelopeBudget{ envelopeId, fromMonth: 'YYYY-MM', amountCents }   // historique des plafonds/contributions
Expense       { id, envelopeId, amountCents, note?, date: 'YYYY-MM-DD', createdAt }
IncomeTemplate{ id, name, amountCents, order }
IncomeEntry   { id, month, name, amountCents, confirmedAt }
MonthClose    { month, proposedCents, confirmedCents | null, status: 'pending'|'confirmed'|'skipped' }
SavingsMove   { id, date, type: 'deposit'|'withdrawal'|'adjustment', account, amountCents, note? }
Settings      { startMonth, startCurrentCents, startSavingsCents, potStartCents{}, fixedSavings: EnvelopeBudget-like }
```

---

## 8. Hors MVP (peut-être plus tard)

- Transfert d'argent entre enveloppes en cas de dépassement.
- Dépense étalée sur plusieurs mois.
- Rappel de sauvegarde.
- Graphiques et statistiques.
- Dépenses récurrentes automatiques.
- Notifications push (elles demanderaient un serveur).
- Synchronisation entre appareils, comptes utilisateurs, connexion bancaire.

---

## 9. Plan de développement

1. **Fondations :** projet, modèle de données, **moteur de calcul + tests**.
2. **Cœur :** accueil, saisie d'une dépense, détail d'une enveloppe.
3. **Cycle mensuel :** revenus à confirmer, bilan, épargne, navigation entre les mois.
4. **Réglages :** premier lancement, enveloppes, vérification du solde, export/import.
5. **PWA :** mode offline, installation, déploiement, test sur ton téléphone.

---

## 10. Points à valider

1. ~~Téléphone~~ → **iPhone** ✅. Les données de l'app installée sont séparées de celles de Safari : l'app doit toujours être ouverte depuis l'icône de l'écran d'accueil.
2. ~~Retrait pour une dépense de cagnotte~~ → **considéré comme fait** ✅ (achats rares et réfléchis ; un oubli est détecté par « Vérifier mon solde »)
3. ~~Montants~~ → **Quotidien 135 / Plaisirs 108 validés** ✅
4. ~~Framework~~ → **Svelte** ✅
5. ~~Hébergement~~ → **GitHub Pages** ✅
