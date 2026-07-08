# SynchRock

Métronome de répétition pour un groupe : un clic par temps (plus aigu sur le
premier temps de chaque mesure), le titre de la chanson et un décompte
annoncés au démarrage, et une annonce vocale du nom de chaque partie qui
arrive, environ une mesure à l'avance. Application web, aucune
installation : une seule page ouverte dans un navigateur (téléphone,
tablette, ordinateur) branché sur une enceinte.

Le setlist est partagé en direct entre tous les visiteurs du site (base de
données Firebase, voir plus bas) : ce que quelqu'un ajoute, modifie ou
réordonne apparaît chez tout le monde sans avoir à recharger la page.

## Utiliser l'app

1. Le setlist se charge automatiquement à l'ouverture de la page — tout le
   monde voit et modifie les mêmes chansons, sur n'importe quel appareil.
   Le bouton "+ Nouvelle chanson" ouvre un éditeur intégré (titre, tempo,
   parties) ; chaque chanson a aussi un bouton ✎ pour la modifier. Pour
   l'instant, n'importe quel visiteur peut modifier le setlist partagé (pas
   encore de comptes / permissions par utilisateur, voir plus bas).
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
synthèse vocale du navigateur. Si une partie suit (nom non vide), le nom de
cette partie suivante ("Refrain"...) est annoncé à la voix en même temps que
le clic du premier temps de ce décompte (au lieu d'être remplacé par
l'échantillon "un") — texte libre, donc lu par la synthèse vocale du
navigateur plutôt que par un échantillon ; le clic continue donc de battre
la mesure pendant l'annonce. Chaque échantillon est automatiquement coupé
net (avec un court fondu) s'il dépasse la durée d'un temps, pour ne jamais
déborder sur le suivant. Décocher "Annonce vocale des parties" remplace ces
échantillons et cette annonce par un simple clic. Une partie nommée `""`
(chaîne vide) n'est jamais annoncée à la voix — utile pour une section que
le groupe connaît déjà sans avoir besoin qu'on la nomme — mais son décompte
de fin continue de fonctionner normalement, et elle peut toujours servir à
annoncer la partie suivante.

Une partie peut aussi être découpée en **sous-parties** (`subParts`) pour
placer des décomptes intermédiaires à l'intérieur d'une longue partie (par
exemple un couplet de 10 mesures qu'on veut re-caler tous les 2-4 mesures).
Chaque sous-partie déclenche son propre décompte "un, deux, trois, quatre"
sur sa dernière mesure avant d'enchaîner sur la sous-partie suivante ; seule
la toute dernière sous-partie annonce en plus la partie suivante, exactement
comme une partie sans subdivision.

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
        { "partName": "couplet", "nbMeasure": 10, "subParts": [2, 4, 4] },
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
- `subParts` (optionnel) : liste du nombre de mesures de chaque sous-partie,
  qui doit sommer à `nbMeasure`. Voir plus haut. Omis (ou absent) pour une
  partie sans subdivision.

C'est la forme des données telle que sauvegardée dans Firestore (voir plus
bas), pas un fichier à éditer à la main.

## Base de données partagée (Firebase)

Le setlist vit dans un unique document Firestore (`setlists/shared`, un
objet `{ songs: [...] }`), lu et écrit par tous les visiteurs en temps réel
via le SDK Firebase côté navigateur — pas de serveur à héberger, le site
reste 100% statique sur GitHub Pages.

**Mise en place (une fois)** :

1. Créer un projet sur [console.firebase.google.com](https://console.firebase.google.com)
   (gratuit à ce niveau d'usage).
2. Dans le projet, activer **Firestore Database** (mode production ou test,
   peu importe — les règles ci-dessous s'appliquent dans les deux cas).
3. Dans **Règles** de Firestore, coller :
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /setlists/{setlistId} {
         allow read, write: if true;
       }
     }
   }
   ```
   ⚠️ Ces règles sont volontairement ouvertes (lecture **et écriture** pour
   n'importe qui connaissant l'URL du site) — cohérent avec "partagé avec
   tous les visiteurs" pour l'instant, mais ça veut dire que n'importe qui
   peut aussi modifier ou effacer le setlist. À restreindre le jour où un
   système de comptes/permissions est ajouté (Firebase Auth + règles basées
   sur l'utilisateur).
4. Ajouter une application web au projet (icône `</>`) pour obtenir les
   valeurs de config (`apiKey`, `authDomain`, `projectId`,
   `storageBucket`, `messagingSenderId`, `appId`).
5. Renseigner ces valeurs comme **secrets du dépôt GitHub**
   (`Settings → Secrets and variables → Actions → New repository secret`),
   un secret par variable listée dans `.env.example`
   (`VITE_FIREBASE_API_KEY`, etc.) — le workflow de déploiement les injecte
   au moment du build.

Ces valeurs ne sont pas des secrets à proprement parler (elles identifient
le projet, l'accès est contrôlé par les règles Firestore ci-dessus), mais
les passer en secrets GitHub évite de les committer en clair.

## Développement

```bash
cp .env.example .env.local   # renseigner les valeurs Firebase (voir ci-dessus)
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
