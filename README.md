# Spendable

Application personnelle de budget par enveloppes, pensée pour l'iPhone.
**Plafond → dépenses → reste.** Tout est stocké sur le téléphone, sans compte, sans serveur et sans abonnement.

Le fonctionnement détaillé est décrit dans [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md).

## Principes

- **Aucune donnée ne quitte le téléphone.** Le site ne sert que les fichiers de l'app ; tout est enregistré dans IndexedDB.
- **Aucun montant personnel dans le code.** Les enveloppes et les soldes sont saisis au premier lancement.
- **L'app ne touche jamais à l'argent.** Elle reflète ce que tu fais et te rappelle les virements à effectuer.

## Développement

```bash
npm install
npm run dev -- --host   # http://localhost:5173 (et l'adresse réseau pour tester sur le téléphone)
npm test                # moteur de calcul
npm run check           # types
npm run build           # version de production dans dist/
npm run preview
```

En développement, l'écran d'accueil propose de charger des **données de démonstration**
(`src/lib/demo.ts`, jamais incluse dans la version publiée).

Les icônes sont générées à partir de `logo.png` (la tuile carrée y est détourée automatiquement) :
`node scripts/generate-icons.mjs`.

## Mise en ligne

Un push sur `main` déclenche le workflow [`deploy.yml`](.github/workflows/deploy.yml) :
tests, vérification des types, build, puis publication sur GitHub Pages.

Réglage nécessaire une fois : **Settings → Pages → Source : GitHub Actions**.

Le site est alors sur `https://<compte>.github.io/<dépôt>/`.

## Installation sur l'iPhone

1. Ouvrir l'adresse dans **Safari** (pas Chrome).
2. **Partager → Sur l'écran d'accueil**.
3. Ouvrir l'app **depuis son icône** : les données de l'app installée sont séparées de celles de Safari.

L'app fonctionne ensuite sans réseau.

## Sauvegarde

⚙️ **Réglages → Sauvegarde → Exporter** télécharge un fichier JSON à ranger dans Fichiers, iCloud Drive ou par mail.
Supprimer l'app de l'écran d'accueil efface ses données : exporter régulièrement est la seule protection.
