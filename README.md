# Dutch

Jeu de cartes multijoueur en français, Next.js App Router, React 19 et TypeScript strict. Interface sombre, table crème texturée et cartes rouges, adaptée aux téléphones et aux tables de 2 à 8 joueurs.

## Démarrage

Node.js 22.13 ou supérieur.

```sh
npm install
npm run dev
```

Ouvrir http://localhost:3000. Créer un salon, puis rejoindre son PIN depuis un autre navigateur ou un autre appareil sur le même réseau. Sur un téléphone, utiliser l’adresse réseau de la machine, avec le port 3000. Les installations PWA et service workers nécessitent HTTPS, sauf sur localhost.

```sh
npm test
npm run typecheck
npm run build
npm start
```

## Déploiement Vercel

Importer ce dossier comme projet Next.js. Aucune commande de déploiement personnalisée. Pour des salons persistants et partagés entre les instances, définir les deux variables de `.env.example` depuis une base Upstash Redis : `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`. Ces secrets restent exclusivement sur le serveur. L’adaptateur utilise l’[API REST officielle Upstash](https://upstash.com/docs/redis/features/restapi).

Sans configuration, un stockage global en mémoire permet de jouer sur un seul processus. Sur Vercel, cette mémoire est éphémère et isolée par instance : un redémarrage ou une requête routée vers une autre instance peut perdre le salon. Ce mode ne garantit donc pas une partie fiable en production. Utiliser Redis pour le déploiement multijoueur. Les salons Redis expirent après 24 heures sans requête.

La synchronisation intégrée utilise un polling séquentiel de 300 ms et BroadcastChannel comme signal d’invalidation entre onglets, jamais comme source de données privées. Un flux SSE authentifié est aussi disponible à `/api/room/[pin]/events` ; utiliser `fetch` avec l’en-tête Bearer et reconnecter après la fermeture du flux (25 secondes). Le client livré emploie le polling, plus simple en environnement serverless. Le polling entraîne des requêtes et des commandes Redis régulières : dimensionner le forfait selon le nombre de joueurs. Supabase n’est pas implémenté ; l’option Redis demandée est fournie.

## Règles et décisions

- Un paquet jusqu’à quatre joueurs, deux à partir de cinq. Roi rouge : 0 ; Roi noir : 13.
- Mémorisation privée de 15 secondes maximum, arrêtée plus tôt lorsque tous ont confirmé.
- Une action normale se termine par « Terminer mon tour » ou « Dutch ». Le bouton Dutch devient disponible à cette étape, jamais avant une pioche.
- Les pouvoirs de Dame et de Valet demandent une sélection explicite. Les coupes de cartes à pouvoir interrompent le tour courant puis le restaurent avec sa carte piochée privée. Un 10 coupé donne un tour supplémentaire au coupeur.
- La coupe est un mode explicite afin d’éviter de confondre un échange volontaire et une tentative de brûlage. Le client transmet l’identifiant de défausse observé. Une tentative visant une ancienne défausse est rejetée ; chaque nouvelle carte brûlée ouvre la chaîne suivante.
- Une coupe adverse réserve l’emplacement jusqu’au don. À expiration du délai de don, la première carte occupée du coupeur est donnée automatiquement.
- À expiration du tour, une carte piochée est jetée ; une carte prise à la défausse remplace obligatoirement la première carte occupée. Son pouvoir est activé. Un pouvoir laissé sans sélection est passé à l’expiration suivante.
- Le 10 n’ajoute pas de tour pendant le dernier tour du Dutch : chaque autre joueur joue exactement une fois.
- L’égalité fait échouer le Dutch, y compris à zéro (+10). Les résultats révèlent toutes les cartes et affichent scores de manche et cumulés.
- « Prêt » est un indicateur de lobby ; l’hôte peut démarrer dès deux participants. Les connexions sont actualisées par heartbeat et les sessions sont restaurées depuis le stockage local.

## Architecture et sécurité

Le serveur est autoritaire. Le jeton aléatoire d’un joueur autorise uniquement sa vue et ses actions, et n’apparaît pas dans les vues des autres joueurs. Une carte cachée n’a ni rang ni couleur transmis : seul son emplacement et son occupation sont publics. Les cartes en mémoire, les visions de Dame et les cartes piochées sont filtrées par destinataire. Les révélations de coupe ratée sont publiques pendant 1,8 seconde.

Les mutations locales sont sérialisées par salon dans leur ordre d’arrivée et travaillent sur une copie transactionnelle. Redis utilise un verrou par salon et une validation atomique par Lua avant l’écriture ; une requête concurrente sur une autre instance peut recevoir « action en cours » et doit être retentée. Il n’y a pas de garantie FIFO globale entre régions Vercel. Les tests couvrent les règles déterministes ; une campagne de charge distribuée reste nécessaire avant une ouverture publique à grande échelle. Il n’y a pas de comptes, de modération ni de protection contre le spam de création de salons dans cette version.

Le service worker ne met jamais en cache les API ni les cartes privées. Il précache les icônes et affiche un message de connexion nécessaire si le réseau est absent. Le jeu multijoueur nécessite le réseau. Le manifeste fournit des icônes SVG normale et maskable ; l’expérience d’installation dépend du navigateur.

## Fichiers

```text
.env.example
.gitignore
package.json
package-lock.json
postcss.config.mjs
tsconfig.json
next-env.d.ts
public/
  icon.svg
  icon-maskable.svg
  icon-192.png
  icon-512.png
  icon-180.png
  sw.js
src/
  app/
    layout.tsx
    page.tsx                 accueil, lobby, plateau, journal, règles, résultats
    globals.css
    manifest.ts
    api/
      game/route.ts          création et entrée dans un salon
      room/[pin]/route.ts    vue privée, heartbeat et commandes
      room/[pin]/events/route.ts
  lib/
    game-engine.ts           règles autoritaires et projection privée
    room-store.ts            stockage transactionnel mémoire / Upstash
    client-store.ts          Zustand, session et synchronisation
  types/game.ts
tests/
  game-engine.test.ts
  tsconfig.json
```

Le projet suit les [Route Handlers Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/route) ; les paramètres dynamiques sont asynchrones.
