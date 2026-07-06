# SynchRock

Métronome de répétition pour un groupe : un clic par temps (plus aigu sur le
premier temps de chaque mesure) et une annonce vocale du nom de la partie
qui arrive, environ une mesure à l'avance. Application web, aucune
installation : une seule page ouverte dans un navigateur (téléphone,
tablette, ordinateur) branché sur une enceinte.

Pensée pour un seul appareil partagé par le groupe pendant la répétition
(pas de synchronisation réseau entre plusieurs téléphones).

## Utiliser l'app

1. Importer une ou plusieurs chansons au format JSON (bouton "Importer un
   JSON de chansons").
2. Choisir une chanson dans la liste.
3. Lancer la lecture : le clic démarre et le nom de la partie en cours
   s'affiche en grand. Cliquer sur une partie dans la liste permet d'y
   sauter directement (pratique pour répéter un couplet ou un solo sans
   rejouer toute la chanson).

Les chansons importées sont sauvegardées dans le navigateur (`localStorage`).

## Format JSON attendu

```json
{
  "songs": [
    {
      "titre": "Ma chanson",
      "bpm": 120,
      "beatsPerMeasure": 4,
      "parts": [
        { "partName": "intro", "nbMeasure": 4 },
        { "partName": "couplet", "nbMeasure": 8 },
        { "partName": "pre refrain", "nbMeasure": 4 },
        { "partName": "refrain", "nbMeasure": 8 },
        { "partName": "break 1", "nbMeasure": 2 },
        { "partName": "solo", "nbMeasure": 8 },
        { "partName": "refrain final", "nbMeasure": 8 },
        { "partName": "outro", "nbMeasure": 4 }
      ]
    }
  ]
}
```

- `titre`, `bpm` et `parts` sont obligatoires.
- `partName` est un texte libre (intro, couplet, pre refrain, refrain,
  interlude, break 1/2/3, solo, refrain final, outro, ou tout autre nom).
- `beatsPerMeasure` (optionnel, défaut `4`) : nombre de clics par mesure.
  Peut être défini au niveau de la chanson et/ou surchargé par partie, pour
  gérer un changement de mesure (3/4, 6/8...) au milieu d'un morceau.
- Un fichier peut aussi être une chanson unique (objet `{ titre, bpm, parts }`)
  ou une liste `[...]` de chansons, sans la clé `songs`.

## Développement

```bash
npm install
npm run dev      # serveur de développement
npm run build    # build de production dans dist/
npm run lint
```

## Déploiement

Le workflow `.github/workflows/deploy.yml` build et publie automatiquement
`dist/` sur GitHub Pages à chaque push sur `main`, via `actions/deploy-pages`.

**Étape unique à faire manuellement** dans les paramètres du dépôt GitHub :
`Settings → Pages → Build and deployment → Source: GitHub Actions`.

Une fois activé, l'app est accessible à l'URL
`https://<utilisateur>.github.io/SynchRock/`.
