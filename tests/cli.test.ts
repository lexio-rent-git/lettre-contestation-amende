// Tests de l'interface en ligne de commande : on lance le vrai binaire et on
// vérifie la sortie sur les cas du README.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

const lettre = (args: string[], entree?: string) =>
  spawnSync(process.execPath, [CLI, ...args], { input: entree, encoding: "utf8" });

const SAISIE_LOUEUR = {
  sousBranche: "b1-locataire",
  denominationSociale: "Garage Bernard Location SARL",
  siren: "123456789",
  nomSignataire: "Claire Bernard",
  qualiteSignataire: "gérante",
  numeroAvis: "1234567890",
  immatriculation: "AB-123-CD",
  dateFaits: "2026-03-10",
  heureFaits: "14:32",
  lieuFaits: "A11, commune de Carquefou",
  datePivot: "2026-03-15",
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

test("modeles : les 12 modèles qui produisent un courrier", () => {
  const r = lettre(["modeles"]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim().split("\n").length, 12);
  assert.match(r.stdout, /^b1-locataire\s+Le véhicule était loué à un tiers$/m);
});

test("courrier : désignation du locataire par un loueur (L. 121-6)", () => {
  const r = lettre(["courrier", "-"], JSON.stringify(SAISIE_LOUEUR));
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Objet : Désignation du conducteur — avis d'infraction n° 1234567890/);
  assert.match(r.stdout, /contrat de location n° LOC-2026-0042/);
  assert.match(r.stdout, /article L\. 121-3, alinéa 4/);
});

test("courrier : un champ de type inattendu est ignoré, pas recopié", () => {
  const r = lettre(["courrier", "-", "--json"], JSON.stringify({ ...SAISIE_LOUEUR, siren: 123 }));
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stdout, /SIREN 123[^4]/);
});

test("saisie : modèle vierge en JSON, voie recalée sur le modèle", () => {
  const r = lettre(["saisie", "b1-locataire"]);
  assert.equal(r.status, 0);
  const s = JSON.parse(r.stdout);
  assert.equal(s.sousBranche, "b1-locataire");
  assert.equal(s.voie, "designation");
});

test("echeance : requête en exonération, avis du 1er mars 2026 → 15 avril, hors délai le 16", () => {
  const r = lettre(["echeance", "--depart", "2026-03-01", "--delai", "exoneration", "--courrier", "2026-04-16", "--json"]);
  assert.equal(r.status, 0);
  const e = JSON.parse(r.stdout);
  assert.equal(e.echeance, "2026-04-15");
  assert.equal(e.horsDelai, true);
});

test("formulations : aveu détecté, code de sortie 1", () => {
  const r = lettre(["formulations", "Je reconnais avoir stationné cinq minutes."]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /je reconnais avoir/);
  assert.match(r.stdout, /cinq minutes/);
});

test("verifier : contrôles internes OK", () => {
  const r = lettre(["verifier"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /aucune divergence/);
});

test("modèle inconnu : code 2 et message explicite", () => {
  const r = lettre(["saisie", "x9"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /modèle « x9 » inconnu/);
});
