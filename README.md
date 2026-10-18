# Générateur de lettre de contestation d'amende

![Licence](https://img.shields.io/badge/licence-MIT-green) ![Node](https://img.shields.io/badge/node-%E2%89%A5%2024-brightgreen) ![Tests](https://img.shields.io/badge/tests-34%20%E2%9C%94-success) ![Dépendances](https://img.shields.io/badge/d%C3%A9pendances-0-blue) [![Essayer en ligne](https://img.shields.io/badge/essayer_en_ligne-lexio.rent-e8590c)](https://lexio.rent/outils/lettre-contestation-amende)

Développé et maintenu par [Lexio](https://lexio.rent), le logiciel de location de voiture et d'utilitaire pour loueurs professionnels.

Moteur TypeScript pur, sans dépendance, du générateur de lettres de contestation d'amende de Lexio : voies de recours, délais, barèmes, gabarits de courrier et garde-fous, sous forme de fonctions **pures** (pas de DOM, pas d'état, pas d'horloge — la date du courrier est toujours une donnée de saisie, jamais `new Date()`), donc rejouables et testables sans framework.

## Ce que fait la bibliothèque

Il n'existe pas « une » procédure pour contester une amende : le tri se fait sur l'**intitulé imprimé du papier reçu**, jamais sur le motif ni sur le montant. Le module couvre :

- **Les voies de contestation** :
  - *Avis de contravention* → requête en exonération (art. 529-2 du code de procédure pénale) ;
  - *Avis d'amende forfaitaire majorée* → réclamation (art. 530, alinéa 2, CPP) ;
  - *Avis de paiement d'un forfait de post-stationnement* (FPS) → recours administratif préalable obligatoire (art. R. 2333-120-13 du CGCT) — ce n'est pas une amende, c'est une redevance ;
  - *Avis de condamnation pécuniaire* → opposition (art. 527 CPP) : voie **routée, jamais rédigée** (elle se forme par déclaration selon les modalités notifiées par le greffe).
- **Les délais et échéances** : `calculerEcheance` et `estHorsDelai` comptent en jours OU en mois selon le texte (45 jours pour l'exonération et la désignation, 30 jours pour la réclamation, 1 mois pour le RAPO…), avec le bon point de départ (**envoi** pour le pénal, **notification** pour le FPS) et le comptage en mois ramené au dernier jour du mois (31 janvier + 1 mois = 28 février, pas le 3 mars).
- **Les montants** : consignation préalable du 2° de l'art. 529-10 (lue dans le barème des classes de contravention, jamais recopiée), majoration du FPS impayé (20 %, plancher de 50 €), barème de la non-désignation (135 € × 5 = 675 € pour une personne morale au stade forfaitaire — étiqueté « non-désignation », jamais affiché en face de l'infraction constatée).
- **Les garde-fous** : `detecterFormulationsInterdites` signale les phrases valant aveu (« je reconnais avoir », « cinq minutes », « j'ai payé »…), les branches exclusives (désigner ET contester la réalité dans le même courrier détruit les deux), les mots d'un autre ordre juridique dans un recours FPS, et un contrôle d'intégrité complet (`verifierContestation`) rejouable à tout moment.
- **Le cas du loueur professionnel** (art. L. 121-6 du code de la route) : la désignation du locataire est une démarche distincte de la contestation, avec son propre délai de 45 jours et sa propre sanction. Le module génère la lettre de désignation complète (identité, adresse ET référence du permis — l'incomplétude est la première cause de rejet chez un loueur), applique le bon texte de transfert de redevabilité (L. 121-2, alinéa 2, ou L. 121-3, alinéa 4, selon la nature de l'infraction) et distingue les trois seules causes d'exonération de l'obligation de désigner (vol, usurpation de plaque, force majeure).

> ### ⚡ Version en ligne
>
> L'outil complet (formulaire guidé, avertissements en direct, impression) est utilisable gratuitement sur
> **<https://lexio.rent/outils/lettre-contestation-amende>**

## Installation

```bash
git clone https://github.com/lexio-rent-git/lettre-contestation-amende
cd lettre-contestation-amende
node --test tests/   # Node ≥ 22.6 (type stripping) ; testé sous Node 24
```

Aucune dépendance, aucune étape de build : le module s'importe directement en TypeScript (Node 24 exécute les `.ts` nativement).

### Exemple d'usage

```ts
import {
  calculerEcheance,
  estHorsDelai,
  montantConsignation,
  montantNonDesignation,
  detecterFormulationsInterdites,
  composerCourrier,
  courrierEnTexte,
  saisieVide,
} from "./src/index.ts";

// Délais : avis de contravention envoyé le 1er mars 2026.
calculerEcheance("2026-03-01", "exoneration")?.echeance;      // "2026-04-15"
estHorsDelai("2026-03-01", "exoneration", "2026-04-16");      // true

// Montants.
montantConsignation("4e", "majoree");                          // { calculable: true, montant: 375, … }
montantNonDesignation("forfaitaire", "morale").montant;        // 675 (135 € × 5, art. 530-3 CPP)

// Garde-fous.
detecterFormulationsInterdites("Je reconnais avoir stationné cinq minutes.");
// -> détecte "je reconnais avoir" (aveu) et "cinq minutes" (situe le stationnement)

// Lettre complète : un loueur désigne son locataire (art. L. 121-6).
const saisie = {
  ...saisieVide("b1-locataire"),
  denominationSociale: "Garage Bernard Location SARL",
  siren: "123456789",
  nomSignataire: "Claire Bernard",
  qualiteSignataire: "gérante",
  numeroAvis: "1234567890",
  immatriculation: "AB-123-CD",
  dateFaits: "2026-03-10",
  heureFaits: "14:32",
  lieuFaits: "A11, commune de Carquefou",
  datePivot: "2026-03-15",            // date d'ENVOI portée sur l'avis
  destinataireEstTitulaire: true,
  infractionListeL121_3: true,
  conducteurNom: "Martin Dupont",
  conducteurNaissance: "1990-05-02",
  conducteurAdresse: "12 rue des Lilas, 44300 Nantes",
  conducteurPermis: "0123456789",
  numeroContrat: "LOC-2026-0042",
  debutLocation: "2026-03-08",
  finLocation: "2026-03-12",
  lieu: "Nantes",
  dateCourrier: "2026-03-20",
};
const courrier = composerCourrier(saisie);
if (courrier) console.log(courrierEnTexte(courrier));
// -> lettre de désignation complète : fondement L. 121-6, bloc de désignation,
//    transfert L. 121-3 al. 4, clause de non-contestation, pièces jointes,
//    mention déontologique en pied de page.
```

Les champs non renseignés sont imprimés en pointillés : un gabarit vide reste un document utilisable au stylo (`specimens()` rend les onze modèles complets sous forme de données pures).

## En ligne de commande et avec Docker

Le dépôt fournit aussi un exécutable `lettre` (`src/cli.ts`), sans dépendance :

```bash
node src/cli.ts modeles                                   # les 12 modèles de courrier
node src/cli.ts saisie b1-locataire > saisie.json         # saisie vierge à compléter
node src/cli.ts courrier saisie.json                      # la lettre, prête à imprimer
node src/cli.ts echeance --depart 2026-03-01 --delai exoneration
# Former une requête en exonération : au plus tard le 2026-04-15
node src/cli.ts formulations "Je reconnais avoir stationné cinq minutes."
```

La même chose sans installer Node, avec l'image Docker [`lexiorent/lettre-contestation-amende`](https://hub.docker.com/r/lexiorent/lettre-contestation-amende) :

```bash
docker run --rm -i lexiorent/lettre-contestation-amende courrier - < saisie.json
```

## API

Fonctions principales (tout est exporté depuis `src/index.ts`) :

| Fonction | Rôle |
| --- | --- |
| `composerCourrier(saisie)` | Compose la lettre complète (en-tête, objet, corps, pièces, pied) — `null` pour la voie routée. |
| `courrierEnTexte(courrier)` | Assemble le courrier en texte brut, celui sur lequel portent les contrôles. |
| `specimens()` | Les gabarits complets, pointillés compris, pour un rendu statique sans JavaScript. |
| `calculerEcheance(depart, delaiId)` | Date limite d'une démarche (jours, mois ou années selon le texte), avec son fondement. |
| `estHorsDelai(depart, delaiId, dateCourrier)` | `true`/`false`, ou `null` sur saisie illisible — on ne conclut jamais « hors délai » sur une date incomplète. |
| `montantConsignation(classe, stade)` | Consignation du 2° de l'art. 529-10, lue dans le barème (`calculable: false` motivé sinon). |
| `montantNonDesignation(stade, personne)` | Barème de la non-désignation (× 5 pour une personne morale), étiqueté « non-désignation ». |
| `calculerMajorationFps(restantDu)` | Majoration d'un FPS impayé : 20 %, plancher de 50 €, et lequel des deux termes a joué. |
| `detecterFormulationsInterdites(texte)` | Formulations valant aveu dans un champ libre (comparaison normalisée, accents ignorés). |
| `avertissements(saisie)` | Tous les avertissements d'une saisie (information / attention / blocage), sans horloge. |
| `consignationRequise(saisie)` | La consignation est-elle exigée, à quel stade, pour quel montant, ou quel document du 1° en dispense. |
| `estDansLeChampDe529_10(faits)` | Champ d'application de l'art. 529-10 : deux conditions **cumulatives**. |
| `texteResponsabiliteLocataire(nature)` | Le bon texte de transfert vers le locataire (L. 121-2 al. 2 ou L. 121-3 al. 4), ou `null`. |
| `combinaisonAutorisee(a, b)` | Deux sous-branches peuvent-elles figurer dans le même courrier, et pourquoi non. |
| `saisieVide(sousBranche)` / `normaliserSaisie(s)` | Modèle de saisie neutre (aucune valeur par défaut n'est une qualification) et recalage voie/sous-branche. |
| `verifierContestation()` | Contrôle d'intégrité complet : tables croisées, verrous, spécimens, rejeu de `CAS_DE_CONTROLE`. Renvoie la liste des divergences (vide si tout passe). |
| `evaluerCas(cas)` | Rejoue un cas de `CAS_DE_CONTROLE` avec les vraies fonctions. |

Données exportées notables : `DELAIS`, `BAREME_CONTRAVENTIONS`, `VOIES`, `GABARITS`, `PIECES_529_10`, `MOTIFS_REJET`, `FORMULATIONS_INTERDITES`, `MENTIONS_OBLIGATOIRES`, `CAS_DE_CONTROLE`, `POINTS_A_LEVER`, `META.sources`.

## Sources officielles

Tous les chiffres, délais et articles du module sont portés par la donnée, avec leur source (la liste complète — 37 références — est exportée dans `META.sources`). Les principales :

- Code de procédure pénale, art. 529-1 (délai de 45 jours) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006576846>
- Code de procédure pénale, art. 529-2 (requête en exonération) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048844668>
- Code de procédure pénale, art. 529-10 (recevabilité : formulaire, pièces du 1°, consignation du 2°) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043375922>
- Code de procédure pénale, art. 530 (réclamation contre l'amende forfaitaire majorée) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048844676>
- Code de procédure pénale, art. 530-1 (suites données à la requête, plancher de l'amende prononcée) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000022494221>
- Code de procédure pénale, art. 530-3 (quintuplement pour les personnes morales) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033460121>
- Code de procédure pénale, art. R. 49 (montants des amendes forfaitaires) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041765693>
- Code de procédure pénale, art. R. 49-7 (montants majorés) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041765684>
- Code de la route, art. L. 121-2 (responsabilité pécuniaire : stationnement, péages) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041599404>
- Code de la route, art. L. 121-3 (redevabilité : contrôle automatique) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039785641>
- Code de la route, art. L. 121-6 (obligation de désigner le conducteur) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043341993>
- Code pénal, art. 131-13 (maximum des amendes contraventionnelles) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417259>
- CGCT, art. L. 2333-87 (forfait de post-stationnement) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043976767>
- CGCT, art. R. 2333-120-13 (recours administratif préalable obligatoire) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030622745>
- CGCT, art. R. 2333-120-16 (majoration du FPS impayé) — <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030622753>
- Cass. crim., 11 décembre 2018, n° 18-82.820 — <https://www.legifrance.gouv.fr/juri/id/JURITEXT000037850932/>
- Service-public.fr, fiche F18510 (amende forfaitaire majorée) — <https://www.service-public.gouv.fr/particuliers/vosdroits/F18510>
- ANTAI, désignation ou contestation — <https://www.antai.gouv.fr/particulier/designation-ou-contestation/>
- ANTAI, téléservice usagers — <https://www.usagers.antai.gouv.fr/demarches/saisienumero>
- ANTAI, espace gestionnaire de flotte — <https://entreprises.antai.gouv.fr/>
- Tribunal du stationnement payant — <https://tribunal-stationnement-payant.fr/>

Les points non tranchés sont documentés dans `POINTS_A_LEVER` et verrouillés mécaniquement : `verifierContestation()` échoue si un verrou saute alors que le point est encore ouvert.

## ⚠️ Avertissement

Pour reprendre la mention imprimée par le module lui-même (art. 54 de la loi n° 71-1130 du 31 décembre 1971) :

> Ce document est un modèle de courrier généré automatiquement à partir des informations que vous avez saisies : il ne constitue ni une consultation juridique, ni un conseil personnalisé, et il ne remplace pas le formulaire joint à votre avis. Les montants, délais et références légales sont ceux en vigueur à la date de mise à jour indiquée. Pour une situation complexe, consultez un avocat.

Le module n'évalue aucune chance de succès, ne produit aucun score et ne qualifie jamais une situation à la place de l'utilisateur : les branches se choisissent sur des faits objectifs (« quel papier avez-vous reçu ? », « le véhicule était-il loué ? »).

## À propos de Lexio

[Lexio](https://lexio.rent) est un logiciel de location de voiture et d'utilitaire pour les loueurs professionnels : planning, contrats, état des lieux photo, facturation. Essai gratuit de 14 jours, sans carte bancaire.
