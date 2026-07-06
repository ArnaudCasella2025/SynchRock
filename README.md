# SynchRock

Métronome de répétition pour un groupe : un clic par temps (plus aigu sur le
premier temps de chaque mesure), le titre de la chanson et un décompte
annoncés au démarrage, et une annonce vocale du nom de chaque partie qui
arrive, environ une mesure à l'avance. Application web, aucune
installation : une seule page ouverte dans un navigateur (téléphone,
tablette, ordinateur) branché sur une enceinte.

Pensée pour un seul appareil partagé par le groupe pendant la répétition
(pas de synchronisation réseau entre plusieurs téléphones).

## Utiliser l'app

1. Le setlist du groupe (`public/songs.json`) se charge automatiquement à
   l'ouverture de la page : tout le monde voit les mêmes chansons, sur
   n'importe quel appareil, sans rien importer. Pour ajouter une chanson
   ponctuelle (pas dans le setlist partagé), le bouton "Importer un JSON de
   chansons" reste disponible et la sauvegarde dans le navigateur
   (`localStorage`).
2. Choisir une chanson dans la liste.
3. Lancer la lecture : le titre est annoncé, suivi d'un décompte ("un, deux,
   trois, quatre"...) sur la première mesure, puis le clic tourne et le nom
   de la partie en cours s'affiche en grand. Cliquer sur une partie dans la
   liste permet d'y sauter directement (pratique pour répéter un couplet ou
   un solo sans rejouer toute la chanson) — dans ce cas, seul le nom de la
   partie est annoncé (pas le titre).

À la dernière mesure de chaque partie (y compris la toute dernière de la
chanson), le décompte ("un, deux, trois, quatre"...) est joué sur chaque
temps pour aider à sentir la transition — via de vrais échantillons audio
enregistrés (`public/audio/claire-1.mp3` à `claire-4.mp3`), lus de façon
échantillon-précise comme le clic, sans les décalages ou coupures de la
synthèse vocale du navigateur. Chaque échantillon est automatiquement coupé
net (avec un court fondu) s'il dépasse la durée d'un temps, pour ne jamais
déborder sur le suivant. Décocher "Annonce vocale des parties" remplace ces
échantillons par un simple clic. Une partie nommée `""` (chaîne vide) n'est
jamais annoncée à la voix — utile pour une section que le groupe connaît déjà
sans avoir besoin qu'on la nomme — mais son décompte de fin continue de
fonctionner normalement, et elle peut toujours servir à annoncer la partie
suivante.

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
  interlude, break 1/2/3, solo, refrain final, outro, ou tout autre nom), ou
  une chaîne vide `""` pour une partie volontairement non annoncée.
- `beatsPerMeasure` (optionnel, défaut `4`) : nombre de clics par mesure.
  Peut être défini au niveau de la chanson et/ou surchargé par partie, pour
  gérer un changement de mesure (3/4, 6/8...) au milieu d'un morceau.
- Un fichier peut aussi être une chanson unique (objet `{ titre, bpm, parts }`)
  ou une liste `[...]` de chansons, sans la clé `songs`.

## Le setlist partagé (`public/songs.json`)

Ce fichier est la source de vérité pour tout le groupe : modifie-le (mêmes
champs que ci-dessus, sous une clé `"songs"`), commit, push sur `main` — le
déploiement automatique republie le site et tout le monde voit le nouveau
setlist à la prochaine ouverture de la page. C'est distinct des imports
manuels (ponctuels, propres à chaque navigateur).

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
