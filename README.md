## Étape 1 : Installation

Avant de commencer, assurez vous d'avoir installé les outils et logiciels suivants sur votre systeme :

-[Node.js](https://nodejs.org)

-[npm](https://www.npmjs.com)

-[MySQL](https://www.mysql.com)

-[MongoDB](https://mongodb.com)

### Installez les dépendances :

```bash
# en utilisant npm
npm install

# puis, si iOS
cd ios

pod install

cd ..
```

### Créez un fichier .env à la racine en vous basant sur le fichier .env :

```bash
cp .env.exemple .env
```

## Étape 2 : Configuration de la base de données

### MySQL :

### Connectez vous à MySQL et créez une base de données :

```sql
CREATE DATABASE your_db_name
```

### MongoDB :

### Connectez vous à MongoDB et créez une base de données :

```bash
mongo
use your_db_name
```

### Créez une collection league_data:

```bash
db.createCollection("league_data")
```

## Étape # : Démarrez le serveur

### Lancez la commande :

```bash
# changez de port si besoin
node servers
```

# Documentation de Déploiement et Infrastructures

## 1. Base de Données SQL (MySQL)

La base de données MySQL est utilisée pour stocker les données de fin de parties de nombreux joueurs. Chaque fois qu'un joueur recherche son nom, les données de ses parties sont collectées et enregistrées, incluant l'historique des parties.

## 2. API en NodeJS

L'API développée en NodeJS sert de middleware entre l'application mobile et les bases de données MySQL et MongoDB. Elle utilise l'API de Riot pour collecter les données de jeu et les stocker dans les bases de données.

## 3. Application Mobile en React-Native

L'application mobile, développée en React-Native, permet aux utilisateurs de rechercher leurs pseudo/tag et d'afficher les données de jeu collectées. Elle interagit avec l'API NodeJS pour récupérer et afficher les informations pertinentes.
