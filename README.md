# 🍁 KILLUA MD V3

WhatsApp bot Multi-Device avec interface web de pairing.

## Installation

```bash
npm install
npm run check
npm start
```

Le serveur utilise `PORT` fourni par l'hébergeur (3000 par défaut).

## Pairing web

1. Ouvre l'interface web.
2. Entre le numéro WhatsApp au format international, sans `+`.
3. Génère le code.
4. Sur WhatsApp : Appareils connectés → Connecter un appareil → Se connecter avec un numéro.
5. Entre le code affiché.

## Tests après installation

```text
.test
.ping
.prefix
.menu
.sticker
.song dadju
```

Pour `.sticker`, réponds à une image avec `.sticker`.

## Propriétaire

Dans `.env` :

```env
OWNER_NUMBER=243XXXXXXXXX
```

Sans cette variable, les commandes envoyées par le compte du bot lui-même restent reconnues comme propriétaire.

## Corrections détaillées

Voir `README-V3-FIXES.md`.
