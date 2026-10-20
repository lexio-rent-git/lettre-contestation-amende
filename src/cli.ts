#!/usr/bin/env node
// Interface en ligne de commande du générateur de lettres de contestation.
// Aucune règle de procédure ici : le fichier lit des options ou un JSON,
// appelle les fonctions du module et met le résultat en forme.
//
//   lettre modeles                       liste les 12 modèles de courrier
//   lettre saisie b1-locataire > s.json  saisie vierge à compléter
//   lettre courrier s.json               lettre prête à imprimer
//   lettre echeance --depart 2026-03-01 --delai exoneration
//   lettre verifier

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import {
  DELAIS,
  GABARITS,
  VOIES,
  avertissements,
  calculerEcheance,
  composerCourrier,
  courrierEnTexte,
  detecterFormulationsInterdites,
  estHorsDelai,
  normaliserSaisie,
  saisieVide,
  verifierContestation,
  type DelaiId,
  type Saisie,
  type SousBranche,
} from "./contestation-amende.ts";

// Sortie coupée par le lecteur (`cli … | head`) : on s'arrête proprement au lieu
// de lever une erreur EPIPE.
process.stdout.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EPIPE") process.exit(0);
  throw e;
});

const VERSION_EN_LIGNE = "https://lexio.rent/outils/lettre-contestation-amende";

const MODELES = (Object.keys(GABARITS) as SousBranche[]).filter((id) => VOIES[GABARITS[id].voie].genereUnCourrier);
const DELAIS_IDS = Object.keys(DELAIS) as DelaiId[];

const AIDE = `Lettres de contestation d'amende (contraventions, désignation du conducteur,
réclamation, recours contre un forfait de post-stationnement) : procédure, délais,
montants de consignation et garde-fous de rédaction.

Usage
  lettre modeles                         liste les modèles de courrier disponibles
  lettre saisie <modele>                 affiche une saisie JSON vierge pour ce modèle
  lettre courrier <saisie.json | ->      compose la lettre (texte prêt à imprimer)
  lettre echeance --depart <AAAA-MM-JJ> --delai <id> [--courrier <AAAA-MM-JJ>]
                                         date limite d'un délai, et si le courrier est hors délai
  lettre formulations "<texte>"          repère les formulations à ne jamais écrire (aveux…)
  lettre verifier                        rejoue les contrôles internes du module
  lettre --help | --version

Délais (--delai) : ${DELAIS_IDS.join(" | ")}

Options
  --json                                 sortie JSON (courrier, échéance, formulations)

Les avertissements (délai dépassé, pièce manquante, voie inadaptée…) sont écrits sur
la sortie d'erreur : la lettre reste produite, à vous de les traiter avant l'envoi.
Cet outil ne remplace pas un avocat. Modèles et explications en ligne :
${VERSION_EN_LIGNE}
Code source (MIT) : https://github.com/lexio-rent-git/lettre-contestation-amende`;

function echec(message: string): never {
  process.stderr.write(`lettre : ${message}\nAide : lettre --help\n`);
  process.exit(2);
}

function date(nom: string, brut: string | undefined): string {
  if (brut === undefined) echec(`--${nom} est obligatoire`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(brut) || Number.isNaN(Date.parse(brut))) {
    echec(`--${nom} attend une date AAAA-MM-JJ, reçu « ${brut} »`);
  }
  return brut;
}

function modele(brut: string | undefined): SousBranche {
  if (!brut || !MODELES.includes(brut as SousBranche)) {
    echec(`modèle « ${brut ?? ""} » inconnu (lettre modeles pour la liste)`);
  }
  return brut as SousBranche;
}

function lireSaisie(source: string | undefined): Saisie {
  if (!source) echec("« courrier » attend un fichier JSON (ou « - » pour l'entrée standard)");
  let brut: unknown;
  try {
    brut = JSON.parse(readFileSync(source === "-" ? 0 : source, "utf8"));
  } catch (e) {
    echec(`lecture de « ${source} » impossible : ${(e as Error).message}`);
  }
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) echec("la saisie doit être un objet JSON");
  const champs = brut as Record<string, unknown>;
  const base = saisieVide(modele(champs.sousBranche as string | undefined));
  // On ne recopie que les clés connues et du bon type : un JSON fantaisiste
  // dégrade la lettre (pointillés), il ne la rend jamais incohérente.
  const s: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(champs)) {
    if (k in base && typeof v === typeof (base as Record<string, unknown>)[k]) s[k] = v;
  }
  return normaliserSaisie(s as Saisie);
}

function main(argv: string[]): void {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      json: { type: "boolean" },
      depart: { type: "string" },
      delai: { type: "string" },
      courrier: { type: "string" },
    },
  });

  const [commande, ...reste] = positionals;
  if (values.version) {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    process.stdout.write(`${pkg.version}\n`);
    return;
  }
  if (values.help || commande === undefined || commande === "aide") {
    process.stdout.write(AIDE + "\n");
    return;
  }

  switch (commande) {
    case "modeles": {
      for (const id of MODELES) process.stdout.write(`${id.padEnd(28)} ${GABARITS[id].libelle}\n`);
      return;
    }
    case "saisie": {
      process.stdout.write(JSON.stringify(saisieVide(modele(reste[0])), null, 2) + "\n");
      return;
    }
    case "courrier": {
      const saisie = lireSaisie(reste[0]);
      const c = composerCourrier(saisie);
      if (!c) echec("ce modèle ne produit pas de courrier");
      for (const a of avertissements(saisie)) process.stderr.write(`⚠ [${a.niveau}] ${a.texte}\n`);
      process.stdout.write(values.json ? JSON.stringify(c, null, 2) + "\n" : courrierEnTexte(c) + "\n");
      return;
    }
    case "echeance": {
      const depart = date("depart", values.depart);
      const id = values.delai as DelaiId;
      if (!DELAIS_IDS.includes(id)) echec(`--delai « ${values.delai ?? ""} » inconnu (valeurs : ${DELAIS_IDS.join(" | ")})`);
      const e = calculerEcheance(depart, id);
      if (!e) echec("échéance non calculable pour ce délai et cette date");
      const hors = values.courrier === undefined ? null : estHorsDelai(depart, id, date("courrier", values.courrier));
      if (values.json) {
        process.stdout.write(JSON.stringify({ ...e, horsDelai: hors }, null, 2) + "\n");
        return;
      }
      process.stdout.write(`${e.delai.intitule} : au plus tard le ${e.echeance}\n`);
      process.stdout.write(`Point de départ : ${e.delai.pointDeDepart}\n`);
      process.stdout.write(`Fondement : ${e.fondement}\n`);
      if (hors !== null) process.stdout.write(hors ? "⚠ Courrier HORS DÉLAI\n" : "Courrier dans le délai\n");
      return;
    }
    case "formulations": {
      const texte = reste.join(" ");
      if (!texte.trim()) echec("« formulations » attend un texte entre guillemets");
      const trouvees = detecterFormulationsInterdites(texte);
      if (values.json) {
        process.stdout.write(JSON.stringify(trouvees, null, 2) + "\n");
      } else if (trouvees.length === 0) {
        process.stdout.write("Aucune formulation à risque détectée.\n");
      } else {
        for (const f of trouvees) process.stdout.write(`⚠ « ${f.expression} » : ${f.motif}\n`);
      }
      if (trouvees.length) process.exitCode = 1;
      return;
    }
    case "verifier": {
      const erreurs = verifierContestation();
      if (erreurs.length) {
        process.stderr.write(`${erreurs.length} divergence(s) :\n${erreurs.join("\n")}\n`);
        process.exit(1);
      }
      process.stdout.write("Contrôles internes : OK, aucune divergence.\n");
      return;
    }
    default:
      echec(`commande « ${commande} » inconnue`);
  }
}

try {
  main(process.argv.slice(2));
} catch (e) {
  echec((e as Error).message);
}
