// Tests du moteur de contestation d'amende.
// Node v24 (type stripping natif) : `node --test tests/`.
// Le module source est copié verbatim depuis la page
// lexio.rent/outils/lettre-contestation-amende : les tests ne le modifient
// jamais, ils le rejouent.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CAS_DE_CONTROLE,
  DELAIS,
  EXEMPLE_COMPTAGE,
  META,
  ajouterJours,
  ajouterMois,
  calculerEcheance,
  calculerMajorationFps,
  combinaisonAutorisee,
  composerCourrier,
  courrierEnTexte,
  detecterFormulationsInterdites,
  estHorsDelai,
  evaluerCas,
  montantConsignation,
  montantNonDesignation,
  motsInterditsTrouves,
  saisieVide,
  verifierContestation,
  type Saisie,
} from "../src/index.ts";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Contrôles internes embarqués : le module embarque son propre jeu de
//    régression (CAS_DE_CONTROLE) et un contrôle d'intégrité complet
//    (verifierContestation). On les rejoue tels quels.
// ─────────────────────────────────────────────────────────────────────────────

test("verifierContestation() ne signale aucune divergence", () => {
  assert.deepEqual(verifierContestation(), []);
});

test("chaque cas de CAS_DE_CONTROLE rejoue à l'identique", () => {
  assert.ok(CAS_DE_CONTROLE.length >= 30, "le jeu de contrôle embarqué est présent");
  for (const cas of CAS_DE_CONTROLE) {
    assert.equal(evaluerCas(cas), cas.attendu, cas.intitule);
  }
});

test("l'exemple de comptage de la page est calculé, pas recopié", () => {
  assert.equal(EXEMPLE_COMPTAGE.depart, "2026-03-01");
  assert.equal(EXEMPLE_COMPTAGE.echeance, "2026-04-15");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Délais : échéances sur dates concrètes, hors-délai, cas limites du
//    calendrier (mois court, année bissextile, date invalide).
// ─────────────────────────────────────────────────────────────────────────────

test("calculerEcheance : requête en exonération, 45 jours à compter de l'envoi", () => {
  const e = calculerEcheance("2026-03-01", "exoneration");
  assert.ok(e);
  assert.equal(e.echeance, "2026-04-15");
  assert.equal(e.delai.valeur, 45);
  assert.match(e.fondement, /529-2/);
});

test("calculerEcheance : réclamation, 30 jours", () => {
  const e = calculerEcheance("2026-03-01", "reclamation");
  assert.ok(e);
  assert.equal(e.echeance, "2026-03-31");
});

test("calculerEcheance : délai en mois ramené au dernier jour du mois (31 janvier + 1 mois = 28 février)", () => {
  const e = calculerEcheance("2026-01-31", "rapo");
  assert.ok(e);
  assert.equal(e.echeance, "2026-02-28");
});

test("ajouterMois : année bissextile, 31 janvier 2028 + 1 mois = 29 février 2028", () => {
  assert.equal(ajouterMois("2028-01-31", 1), "2028-02-29");
});

test("ajouterJours / calculerEcheance : date illisible -> null, jamais une échéance devinée", () => {
  assert.equal(ajouterJours("2026-02-31", 45), null); // quantième inexistant
  assert.equal(ajouterJours("pas-une-date", 45), null);
  assert.equal(calculerEcheance("2026-02-31", "exoneration"), null);
});

test("estHorsDelai : la veille, le jour même (inclus), le lendemain", () => {
  // Échéance : 2026-04-15.
  assert.equal(estHorsDelai("2026-03-01", "exoneration", "2026-04-14"), false);
  assert.equal(estHorsDelai("2026-03-01", "exoneration", "2026-04-15"), false);
  assert.equal(estHorsDelai("2026-03-01", "exoneration", "2026-04-16"), true);
});

test("estHorsDelai : saisie illisible -> null, on ne conclut jamais « hors délai »", () => {
  assert.equal(estHorsDelai("", "exoneration", "2026-04-16"), null);
  assert.equal(estHorsDelai("2026-03-01", "exoneration", ""), null);
});

test("prescription de la peine : 3 années comptées en mois (36)", () => {
  const e = calculerEcheance("2026-03-01", "prescription-peine");
  assert.ok(e);
  assert.equal(e.echeance, "2029-03-01");
  assert.equal(DELAIS["prescription-peine"].unite, "annees");
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Montants : consignation (art. 529-10, 2°) et non-désignation
//    (art. L. 121-6, quintuplement personne morale).
// ─────────────────────────────────────────────────────────────────────────────

test("montantConsignation : 4e classe, stade forfaitaire = 135 €", () => {
  const c = montantConsignation("4e", "forfaitaire");
  assert.ok(c.calculable);
  assert.equal(c.montant, 135);
  assert.match(c.article, /529-10, 2°/);
});

test("montantConsignation : 4e classe, stade majoré = 375 €", () => {
  const c = montantConsignation("4e", "majoree");
  assert.ok(c.calculable);
  assert.equal(c.montant, 375);
  // Le verbatim rassurant voyage avec le montant.
  assert.match(c.verbatim, /ne donne pas lieu au retrait des points/);
});

test("montantConsignation : 1re classe, stade majoré = 33 €", () => {
  const c = montantConsignation("1re", "majoree");
  assert.ok(c.calculable);
  assert.equal(c.montant, 33);
});

test("montantNonDesignation : personne morale, 135 € × 5 = 675 € au stade forfaitaire", () => {
  const m = montantNonDesignation("forfaitaire", "morale");
  assert.equal(m.montant, 675);
  assert.equal(m.etiquette, "non-designation");
  assert.match(m.libelle, /non-designation/i);
  assert.match(m.article, /530-3/);
});

test("montantNonDesignation : personne morale, stade majoré = 1 875 €, maximum tribunal = 3 750 €", () => {
  assert.equal(montantNonDesignation("majoree", "morale").montant, 1875);
  const max = montantNonDesignation("maximum-tribunal", "morale");
  assert.equal(max.montant, 3750);
  assert.match(max.article, /131-41/); // fondement du quintuplement au maximum
});

test("montantNonDesignation : personne physique, pas de quintuplement (135 €)", () => {
  assert.equal(montantNonDesignation("forfaitaire", "physique").montant, 135);
});

test("calculerMajorationFps : plancher de 50 € sur un forfait de 17 €, proportionnelle au-delà", () => {
  const petit = calculerMajorationFps(17);
  assert.ok(petit);
  assert.equal(petit.majoration, 50);
  assert.equal(petit.plancherApplique, true);
  assert.equal(petit.total, 67);

  const grand = calculerMajorationFps(400);
  assert.ok(grand);
  assert.equal(grand.majoration, 80);
  assert.equal(grand.plancherApplique, false);

  assert.equal(calculerMajorationFps(0), null);
  assert.equal(calculerMajorationFps(Number.NaN), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Garde-fous : détection des formulations valant aveu.
// ─────────────────────────────────────────────────────────────────────────────

test("detecterFormulationsInterdites : une phrase à risque est détectée malgré accents et majuscules", () => {
  const detections = detecterFormulationsInterdites(
    "Je RECONNAIS avoir stationné, mais je n'étais là que cinq minutes.",
  );
  const expressions = detections.map((d) => d.expression);
  assert.ok(expressions.includes("je reconnais avoir"), "aveu détecté");
  assert.ok(expressions.includes("cinq minutes"), "durée courte détectée");
});

test("detecterFormulationsInterdites : « j'ai payé » détecté avec l'apostrophe typographique", () => {
  const d = detecterFormulationsInterdites("J’ai payé cette amende la semaine dernière.");
  assert.ok(d.some((x) => x.expression === "j'ai payé"));
});

test("detecterFormulationsInterdites : une phrase saine passe, un texte vide aussi", () => {
  assert.deepEqual(
    detecterFormulationsInterdites(
      "La signalisation était absente à cet emplacement, comme le montrent les photographies jointes.",
    ),
    [],
  );
  assert.deepEqual(detecterFormulationsInterdites("   "), []);
});

test("combinaisonAutorisee : désigner et contester la réalité sont exclusifs", () => {
  const interdit = combinaisonAutorisee("a1-conducteur", "a3-realite");
  assert.equal(interdit.autorisee, false);
  assert.ok(interdit.motif);
  const ok = combinaisonAutorisee("b1-locataire", "a2-evenement");
  assert.equal(ok.autorisee, true);
  assert.equal(ok.motif, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Génération d'une lettre complète : scénario type du loueur professionnel
//    qui désigne son locataire (art. L. 121-6, branche b1-locataire).
// ─────────────────────────────────────────────────────────────────────────────

function saisieLoueur(): Saisie {
  return {
    ...saisieVide("b1-locataire"),
    denominationSociale: "Garage Bernard Location SARL",
    siren: "123456789",
    nomSignataire: "Claire Bernard",
    qualiteSignataire: "gérante",
    adresse: "4 avenue de la République",
    codePostal: "44000",
    ville: "Nantes",
    email: "contact@exemple.fr",
    telephone: "02 40 00 00 00",
    destinataireBloc: "Officier du ministère public\nCS 41101\n35911 Rennes Cedex 9",
    numeroAvis: "1234567890",
    immatriculation: "AB-123-CD",
    dateFaits: "2026-03-10",
    heureFaits: "14:32",
    lieuFaits: "A11, commune de Carquefou",
    datePivot: "2026-03-15",
    natureInfraction: "controle-automatique",
    classe: "4e",
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
}

test("composerCourrier : lettre de désignation du locataire, mentions clés présentes", () => {
  const courrier = composerCourrier(saisieLoueur());
  assert.ok(courrier, "la branche b1-locataire génère un courrier");
  const texte = courrierEnTexte(courrier);

  // Fondement légal et objet.
  assert.match(texte, /article L\. 121-6 du code de la route/);
  assert.match(courrier.objet, /^Désignation du conducteur/);
  assert.match(courrier.objet, /1234567890/);

  // Le loueur et le locataire désigné.
  assert.match(texte, /Garage Bernard Location SARL/);
  assert.match(texte, /SIREN 123456789/);
  assert.match(texte, /Martin Dupont/);
  assert.match(texte, /12 rue des Lilas, 44300 Nantes/);
  assert.match(texte, /Référence du permis de conduire : 0123456789/);

  // Le contrat de location et le transfert de redevabilité (contrôle
  // automatique -> art. L. 121-3, alinéa 4).
  assert.match(texte, /contrat de location n° LOC-2026-0042/);
  assert.match(texte, /L\. 121-3, alinéa 4/);

  // La clause de non-contestation, et la double portée 529-10 1° b).
  assert.match(texte, /ne constitue pas une contestation de la réalité de l'infraction/);
  assert.match(texte, /1° b\) de l'article 529-10/);

  // Dates françaises, clause de délai maintenue (courrier dans les 45 jours).
  assert.match(texte, /le 20 mars 2026/);
  assert.match(texte, /dans le délai de quarante-cinq jours/);
  assert.match(texte, /14 h 32/);

  // Pièces jointes et pied de page déontologique.
  assert.ok(courrier.pieces.includes("Copie du contrat de location visé ci-dessus"));
  assert.ok(courrier.pieces.includes("Copie du permis de conduire du locataire"));
  assert.match(texte, /ne constitue ni une consultation juridique/);

  // Rien de technique ne fuit dans le document.
  assert.ok(!texte.includes("undefined"));
  assert.ok(!texte.includes("NaN"));
  assert.ok(!texte.includes("Invalid Date"));

  // Aucun mot d'un autre régime.
  assert.deepEqual(motsInterditsTrouves(courrier), []);
});

test("composerCourrier : hors délai, la clause « dans le délai de quarante-cinq jours » est tue", () => {
  const s = { ...saisieLoueur(), dateCourrier: "2026-09-01" };
  const courrier = composerCourrier(s);
  assert.ok(courrier);
  const texte = courrierEnTexte(courrier);
  assert.ok(!texte.includes("dans le délai de quarante-cinq jours"));
});

test("composerCourrier : la voie routée (ordonnance pénale) ne génère aucun courrier", () => {
  assert.equal(composerCourrier(saisieVide("z-routage")), null);
});

test("META : les sources officielles sont bien présentes et résolvables en https", () => {
  assert.ok(META.sources.length >= 30);
  for (const s of META.sources) assert.match(s.url, /^https:\/\//);
});
