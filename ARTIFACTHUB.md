# Lettre de contestation d'amende et désignation du conducteur, en ligne de commande

Compose les courriers de la procédure contraventionnelle française : **requête en exonération**, **désignation du conducteur** (art. L. 121-6 du code de la route), **réclamation** contre une amende majorée et **recours** contre un forfait de post-stationnement. 12 modèles, chacun avec son fondement, ses pièces jointes obligatoires et ses mentions.

- Calcul des délais (exonération, désignation, réclamation, recours, prescription…) à partir du bon point de départ, jamais la date de réception
- Montants de consignation et de la contravention de non-désignation
- Détection des formulations à ne jamais écrire (aveux, précisions qui situent l'infraction)
- Avertissements quand une voie ne convient pas, par exemple un avis d'amende forfaitaire délictuelle
- Cas des loueurs : désignation du locataire avec le numéro et les dates du contrat de location
- Aucune dépendance : Node 24 sur Alpine, exécuté en utilisateur non root ; tests rejoués à chaque build

Vous préférez remplir un formulaire ? Le même générateur existe en ligne, avec la lettre prête à imprimer : **[générateur de lettre de contestation d'amende](https://lexio.rent/outils/lettre-contestation-amende)**.

## Utilisation

```bash
# Les modèles disponibles
docker run --rm lexiorent/lettre-contestation-amende modeles

# Une saisie vierge à compléter (ici : un loueur désigne son locataire)
docker run --rm lexiorent/lettre-contestation-amende saisie b1-locataire > saisie.json

# La lettre, prête à imprimer (les avertissements sortent sur stderr)
docker run --rm -i lexiorent/lettre-contestation-amende courrier - < saisie.json

# Date limite d'un délai, et contrôle d'un courrier hors délai
docker run --rm lexiorent/lettre-contestation-amende echeance --depart 2026-03-01 --delai exoneration --courrier 2026-04-16
# Former une requête en exonération : au plus tard le 2026-04-15
# ⚠ Courrier HORS DÉLAI

# Relire un brouillon avant envoi
docker run --rm lexiorent/lettre-contestation-amende formulations "Je reconnais avoir stationné cinq minutes."
```

## Tags

- `latest`, `0.2.1`

## Avertissement

Outil d'aide à la rédaction : il ne remplace pas le conseil d'un avocat. Les champs non renseignés sont imprimés en pointillés, à compléter à la main.

## Source et licence

Code source sous licence MIT : [github.com/lexio-rent-git/lettre-contestation-amende](https://github.com/lexio-rent-git/lettre-contestation-amende).

Développé et maintenu par [Lexio Rent](https://lexio.rent/logiciel-location-voiture), logiciel de location de voiture et d'utilitaire pour les loueurs professionnels.
