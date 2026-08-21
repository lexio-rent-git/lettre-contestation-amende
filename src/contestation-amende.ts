// ─────────────────────────────────────────────────────────────────────────────
// src/data/contestation-amende.ts
// Voies de recours, delais, baremes, gabarits de courrier et moteur de
// composition du generateur de lettre de contestation d'amende.
//
// Pourquoi du TypeScript et pas un JSON (contrairement a parc-*.ts, zfe.ts…) :
// un paragraphe de courrier n'est pas une donnee inerte, c'est une fonction
// `(s: Saisie) => string[]`. Un JSON aurait impose un mini-langage de
// substitution maison, sans aucune verification a la compilation que le champ
// interpole existe encore — sur une piece produite a l'administration, une
// variable non substituee est une irrecevabilite.
//
// Pourquoi ce module est le SEUL endroit ou l'on calcule et ou l'on redige :
// une lettre de contestation engage un delai de forclusion. Un delai faux ferme
// un recours. On veut donc pouvoir rejouer chaque regle sans monter React —
// d'ou des fonctions PURES, sans DOM, sans etat, sans horloge (la date du
// courrier est TOUJOURS une donnee de saisie, jamais `new Date()` : un moteur
// de calcul qui lit l'heure n'est pas rejouable).
//
// AVERTISSEMENT DE FOND, a repercuter partout dans l'interface : il n'existe pas
// « une » procedure pour contester une amende. Il en existe quatre, dont une
// seule n'est pas penale, et le tri ne se fait JAMAIS sur le motif ni sur le
// montant : il se fait sur l'INTITULE IMPRIME du papier recu.
//   1. avis de contravention          -> requete en exoneration (529-2 CPP)
//   2. avis d'amende forfaitaire majoree -> reclamation (530 al. 2 CPP)
//   3. avis de condamnation pecuniaire -> opposition (527 CPP) : NON GENEREE,
//      l'outil se contente de router (voir NOTE_ROUTAGE_ORDONNANCE_PENALE)
//   4. avis de paiement d'un forfait de post-stationnement -> RAPO
//      (R2333-120-13 CGCT) : ce n'est pas une amende, c'est une redevance.
// La designation du conducteur par une personne morale (L121-6 du code de la
// route) est une CINQUIEME demarche, qui n'est pas une contestation : elle a son
// propre delai, son propre destinataire et sa propre sanction.
//
// DEONTOLOGIE (art. 54 de la loi n° 71-1130) : ce module ASSEMBLE un document a
// partir de champs saisis et de textes legaux. Il ne qualifie jamais une
// situation a la place de l'utilisateur, n'evalue aucune chance de succes et ne
// produit aucun score. Les branches sont choisies par l'utilisateur sur des
// faits objectifs (« quel papier avez-vous recu ? », « le vehicule etait-il
// loue ? »), jamais sur une qualification juridique que l'outil poserait.
//
// SEO — pourquoi `specimens()` existe : sur ce groupe de requetes, le troisieme
// resultat d'une SERP a 1 000 recherches par mois est un simple fichier PDF. Un
// document uniquement peint par JavaScript apres interaction n'est donc pas
// competitif. `specimens()` rend chaque gabarit COMPLET, avec ses pointilles a
// completer, sous forme de donnees pures : la page serveur peut l'imprimer dans
// le HTML statique, hors de toute frontiere Suspense, donc lisible par un moteur
// et par un visiteur sans JavaScript.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Date de revision, isolee de META.
 *
 * Le composant client n'a besoin QUE de cette date. Importer `META` pour la
 * lire embarquait le litteral entier — trente-sept sources, nom et URL, neuf
 * kilo-octets — dans le bundle : `META` est un `as const`, aucun bundler ne
 * peut en extraire une seule propriete.
 */
export const MISE_A_JOUR = "2026-08-03" as const;

export const META = {
  miseAJour: MISE_A_JOUR,
  version: "1.0.0",
  /**
   * Sources citees en pied de page ET dans le JSON-LD (`citation[]`).
   * Regle du repo : aucun chiffre, aucun delai, aucun article n'est ecrit en dur
   * dans la prose de la page — tout est derive d'ici, donc le texte affiche ne
   * peut pas diverger du document produit.
   *
   * Toutes les URL ci-dessous ont ete ouvertes lors de la redaction de la note
   * de cadrage. Les references dont l'URL n'a PAS pu etre verifiee (fiche
   * service-public F34212, LOI n° 2025-622 du 9 juillet 2025, decrets
   * n° 2025-1269 et n° 2024-733, decision n° 2020-855 QPC) sont citees par leur
   * numero dans les notes editoriales, SANS lien : une source qui rend un
   * soft-404 vaut moins que pas de source.
   */
  sources: [
    // ── Code de procedure penale ──
    {
      nom: "Code de procédure pénale, art. 527 (opposition à l'ordonnance pénale), version en vigueur du 5 juin 2016 au 1er janvier 2029",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032655676",
    },
    {
      nom: "Code de procédure pénale, art. 529-1 (délai de 45 jours, point de départ : constatation ou envoi de l'avis)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006576846",
    },
    {
      nom: "Code de procédure pénale, art. 529-2 (requête en exonération), version en vigueur du 1er janvier 2024 au 1er janvier 2029",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048844668",
    },
    {
      // NE JAMAIS employer LEGIARTI000006576859 : cet identifiant est celui de
      // l'article 529-6 (transaction pour non-paiement du peage autoroutier). La
      // page a ete ouverte : elle rend « Article 529-6 ». Meme piege que celui
      // deja documente sur R. 49 quelques lignes plus bas.
      nom: "Code de procédure pénale, art. 529-7 (amende forfaitaire minorée : contraventions au code de la route des 2e à 5e classes, à l'exception du stationnement)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006576861",
    },
    {
      nom: "Code de procédure pénale, art. 529-8 (amende forfaitaire minorée, délai de 15 jours)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030254337",
    },
    {
      nom: "Code de procédure pénale, art. 529-10 (recevabilité : formulaire joint, pièces du 1°, consignation du 2°), version en vigueur du 16 avril 2021 au 1er janvier 2029",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043375922",
    },
    {
      nom: "Code de procédure pénale, art. 530 (titre exécutoire et réclamation contre l'amende forfaitaire majorée), version en vigueur du 1er janvier 2024 au 1er janvier 2029",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048844676",
    },
    {
      nom: "Code de procédure pénale, art. 530-1 (suites données à la requête ou à la réclamation, plancher de l'amende prononcée)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000022494221",
    },
    {
      nom: "Code de procédure pénale, art. 530-3 (quintuplement des amendes forfaitaires applicables à une personne morale)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033460121",
    },
    {
      nom: "Code de procédure pénale, art. R. 48-1 (contraventions soumises à la procédure de l'amende forfaitaire), version en vigueur au 30 juillet 2026",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046490578",
    },
    {
      // NE JAMAIS employer LEGIARTI000006517397 : c'est la version 1986 de R. 49,
      // exprimee en francs (900 F en 4e classe). L'identifiant ci-dessous est la
      // version issue du decret n° 2020-357 du 28 mars 2020.
      nom: "Code de procédure pénale, art. R. 49 (montant des amendes forfaitaires), version en vigueur du 29 mars 2020",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041765693",
    },
    {
      nom: "Code de procédure pénale, art. R. 49-3-1 (délai supplémentaire de 15 jours pour le télépaiement ou le timbre dématérialisé), version en vigueur du 1er octobre 2008",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000019282244",
    },
    {
      nom: "Code de procédure pénale, art. R. 49-7 (montant des amendes forfaitaires majorées)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041765684",
    },
    {
      nom: "Code de procédure pénale, art. R. 49-9 (montant des amendes forfaitaires minorées)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006517433",
    },
    // ── Code de la route ──
    {
      nom: "Code de la route, art. L. 121-2 (responsabilité pécuniaire : stationnement, péages, dépôts d'ordures), version en vigueur du 12 février 2020",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041599404",
    },
    {
      nom: "Code de la route, art. L. 121-3 (redevabilité pécuniaire pour les infractions du contrôle automatique), version en vigueur du 27 décembre 2019",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039785641",
    },
    {
      nom: "Code de la route, art. L. 121-6 (obligation de désigner le conducteur), version en vigueur du 31 décembre 2025",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043341993",
    },
    // Procédure de l'amende forfaitaire DÉLICTUELLE. Aucune branche de l'outil ne
    // la produit : ces deux références servent à l'avertissement bloquant, qui
    // renvoie l'utilisateur vers la bonne voie plutôt que de lui donner un
    // courrier irrecevable. Verbatims relevés le 2026-08-05.
    {
      nom: "Code de procédure pénale, art. 495-19 (réclamation contre une amende forfaitaire délictuelle majorée, 30 jours de l'envoi), version en vigueur du 25 mars 2019",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038312348",
    },
    {
      nom: "Code de procédure pénale, art. 495-20 (recevabilité : recommandé, formulaire joint, consignation — ou plainte pour usurpation d'identité)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038312345",
    },
    {
      nom: "Code de la route, art. L. 223-1 (le paiement établit la réalité de l'infraction pour le permis à points), version en vigueur du 30 mars 2018",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036749888",
    },
    {
      nom: "Code de la route, art. L. 317-4-1 (délit d'usurpation de plaque d'immatriculation)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006841108",
    },
    {
      nom: "Code de la route, art. R. 121-6 (liste des infractions relevant de l'art. L. 121-3), version en vigueur du 29 décembre 2025",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049692297",
    },
    {
      nom: "Code de la route, art. R. 130-11 (périmètre du contrôle automatique de l'art. L. 130-9)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037411183",
    },
    // ── Code penal ──
    {
      nom: "Code pénal, art. 131-13 (montant maximal des amendes contraventionnelles)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417259",
    },
    {
      nom: "Code pénal, art. 131-41 (quintuplement du taux maximal pour les personnes morales)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417342",
    },
    {
      nom: "Code pénal, art. 133-4 (prescription de la peine : trois années révolues en matière contraventionnelle)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417513",
    },
    // ── Code general des collectivites territoriales ──
    {
      nom: "CGCT, art. L. 2333-87 (forfait de post-stationnement), version en vigueur du 1er janvier 2025",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043976767",
    },
    {
      nom: "CGCT, art. R. 2333-120-13 (recours administratif préalable obligatoire contre un forfait de post-stationnement), version en vigueur du 1er janvier 2018",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030622745",
    },
    {
      nom: "CGCT, art. R. 2333-120-14 (avis de paiement rectificatif)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049919728",
    },
    {
      nom: "CGCT, art. R. 2333-120-16 (majoration du forfait de post-stationnement impaye)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030622753",
    },
    {
      nom: "CGCT, art. R. 2333-120-33 (saisine du tribunal du stationnement payant)",
      url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030713696",
    },
    // ── Autres ──
    {
      nom: "Loi n° 71-1130 du 31 décembre 1971, art. 54 (consultation juridique et rédaction d'actes à titre habituel et rémunéré)",
      url: "https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000039280601",
    },
    {
      nom: "Cass. crim., 11 décembre 2018, n° 18-82.820 (obligation de désigner : le libellé de l'avis au nom de la personne morale est indifférent)",
      url: "https://www.legifrance.gouv.fr/juri/id/JURITEXT000037850932/",
    },
    {
      nom: "Service-public.fr, fiche F18510 (amende forfaitaire majorée), mise à jour du 24 juin 2025",
      url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F18510",
    },
    {
      nom: "ANTAI, espace professionnel — réglementation applicable aux personnes morales",
      url: "https://www.antai.gouv.fr/professionnel/reglementation/",
    },
    {
      nom: "ANTAI, désignation ou contestation (particuliers)",
      url: "https://www.antai.gouv.fr/particulier/designation-ou-contestation/",
    },
    {
      nom: "ANTAI, téléservice usagers — saisie du numéro d'avis",
      url: "https://www.usagers.antai.gouv.fr/demarches/saisienumero",
    },
    {
      nom: "ANTAI, espace gestionnaire de flotte (désignation en masse)",
      url: "https://entreprises.antai.gouv.fr/",
    },
    {
      nom: "Tribunal du stationnement payant (ex-commission du contentieux du stationnement payant)",
      url: "https://tribunal-stationnement-payant.fr/",
    },
  ],
} as const;

export type SourceRef = { nom: string; url: string };

/**
 * Statut de fiabilite porte par la DONNEE elle-meme, jamais par un commentaire.
 * - "verifie" : adosse au texte sur Legifrance ou a une notice officielle.
 * - "deduit"  : application d'un texte a un cas que l'administration n'a pas
 *               documente. Le bloc porte alors une `note` rendue a l'ecran ET
 *               sur le document imprime, jamais masquee.
 * Le statut "non-verifie" n'existe PAS dans cette union : il appartient au type
 * `BaremeInformatif`, structurellement inutilisable par le moteur.
 */
export type Statut = "verifie" | "deduit";

/** Libelle d'affichage d'un statut : les valeurs de l'union sont des
    identifiants compares dans le code, leur rendu est du francais. */
export const LIBELLE_STATUT: Readonly<Record<Statut, string>> = {
  verifie: "vérifié",
  deduit: "déduit",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sources ponctuelles, reutilisees par plusieurs entrees de bareme ou de delai.
// On les declare une fois : un identifiant Legifrance recopie a cinq endroits
// finit par diverger d'un endroit sur cinq.
// ─────────────────────────────────────────────────────────────────────────────

const SRC_529_1: SourceRef = {
  nom: "Code de procédure pénale, art. 529-1",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006576846",
};
const SRC_529_2: SourceRef = {
  nom: "Code de procédure pénale, art. 529-2, version en vigueur du 1er janvier 2024",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048844668",
};
const SRC_529_7: SourceRef = {
  nom: "Code de procédure pénale, art. 529-7",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006576861",
};
const SRC_529_8: SourceRef = {
  nom: "Code de procédure pénale, art. 529-8",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030254337",
};
const SRC_529_10: SourceRef = {
  nom: "Code de procédure pénale, art. 529-10, version en vigueur du 16 avril 2021",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043375922",
};
const SRC_530: SourceRef = {
  nom: "Code de procédure pénale, art. 530, version en vigueur du 1er janvier 2024",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048844676",
};
const SRC_530_1: SourceRef = {
  nom: "Code de procédure pénale, art. 530-1",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000022494221",
};
const SRC_530_3: SourceRef = {
  nom: "Code de procédure pénale, art. 530-3",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033460121",
};
const SRC_527: SourceRef = {
  nom: "Code de procédure pénale, art. 527",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032655676",
};
const SRC_R48_1: SourceRef = {
  nom: "Code de procédure pénale, art. R. 48-1, version en vigueur au 30 juillet 2026",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046490578",
};
const SRC_R49: SourceRef = {
  nom: "Code de procédure pénale, art. R. 49, version en vigueur du 29 mars 2020",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041765693",
};
const SRC_R49_3_1: SourceRef = {
  nom: "Code de procédure pénale, art. R. 49-3-1",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000019282244",
};
const SRC_R49_7: SourceRef = {
  nom: "Code de procédure pénale, art. R. 49-7",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041765684",
};
const SRC_R49_9: SourceRef = {
  nom: "Code de procédure pénale, art. R. 49-9",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006517433",
};
const SRC_131_13: SourceRef = {
  nom: "Code pénal, art. 131-13",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417259",
};
const SRC_131_41: SourceRef = {
  nom: "Code pénal, art. 131-41",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417342",
};
const SRC_133_4: SourceRef = {
  nom: "Code pénal, art. 133-4",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417513",
};
const SRC_L121_2: SourceRef = {
  nom: "Code de la route, art. L. 121-2, version en vigueur du 12 février 2020",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041599404",
};
const SRC_L121_3: SourceRef = {
  nom: "Code de la route, art. L. 121-3, version en vigueur du 27 décembre 2019",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039785641",
};
const SRC_L121_6: SourceRef = {
  nom: "Code de la route, art. L. 121-6, version en vigueur du 31 décembre 2025",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043341993",
};
const SRC_L223_1: SourceRef = {
  nom: "Code de la route, art. L. 223-1, version en vigueur du 30 mars 2018",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036749888",
};
const SRC_L317_4_1: SourceRef = {
  nom: "Code de la route, art. L. 317-4-1",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006841108",
};
const SRC_L2333_87: SourceRef = {
  nom: "CGCT, art. L. 2333-87, version en vigueur du 1er janvier 2025",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043976767",
};
const SRC_R2333_120_13: SourceRef = {
  nom: "CGCT, art. R. 2333-120-13, version en vigueur du 1er janvier 2018",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030622745",
};
const SRC_R2333_120_16: SourceRef = {
  nom: "CGCT, art. R. 2333-120-16",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030622753",
};
const SRC_R2333_120_33: SourceRef = {
  nom: "CGCT, art. R. 2333-120-33",
  url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030713696",
};
// `SRC_R121_6` et `SRC_ANTAI_PRO` ont ete supprimees : elles n'avaient aucun
// appelant et faisaient double emploi avec les entrees correspondantes de
// `META.sources`, qui sont celles rendues sur la page et dans le JSON-LD.
const SRC_ANTAI_PARTICULIER: SourceRef = {
  nom: "ANTAI, désignation ou contestation",
  url: "https://www.antai.gouv.fr/particulier/designation-ou-contestation/",
};
const SRC_F18510: SourceRef = {
  nom: "Service-public.fr, fiche F18510, mise à jour du 24 juin 2025",
  url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F18510",
};

// ─────────────────────────────────────────────────────────────────────────────
// Regles chiffrees isolees
//
// Chacune de ces trois regles etait, dans la premiere ecriture de ce module,
// retapee au milieu d'une chaine d'aide (« depuis le 1er janvier 2018 », « 20 %
// … 50 euros », « sept ans … 30 000 euros »). Un chiffre noye dans une phrase
// n'a pas de source, ne se corrige pas d'un seul endroit et ne se rejoue pas.
// On les sort donc en constantes sourcees, et les phrases sont DERIVEES.
// ─────────────────────────────────────────────────────────────────────────────

/** Depenalisation du stationnement payant. C'est le fait qui commande tout le
    tri de la branche D : un forfait de post-stationnement n'est pas une amende,
    donc ni retrait de points, ni requete en exoneration, ni officier du
    ministere public, ni consignation. */
export const DEPENALISATION_STATIONNEMENT = {
  date: "2018-01-01",
  libelle: "1er janvier 2018",
  consequence:
    "Le stationnement payant non réglé n'est plus une infraction pénale : c'est une redevance d'occupation du domaine public. Il n'y a donc ni retrait de points, ni requête en exonération, ni officier du ministère public, ni consignation.",
  article: "art. L. 2333-87 du code général des collectivités territoriales",
  source: SRC_L2333_87,
  statut: "verifie" as Statut,
} as const;

/** Majoration du forfait de post-stationnement impaye — art. R. 2333-120-16
    CGCT : « 20 % du montant du forfait de post-stationnement impaye restant du,
    sans pouvoir etre inferieur a 50 € ». Le plancher n'est pas un arrondi : sur
    un forfait de 17 euros, la majoration vaut 50 euros, soit trois fois le
    forfait. C'est ce que la fonction `calculerMajorationFps` rend visible. */
export const MAJORATION_FPS = {
  taux: 0.2,
  plancher: 50,
  article: "art. R. 2333-120-16 du code général des collectivités territoriales",
  source: SRC_R2333_120_16,
  statut: "verifie" as Statut,
} as const;

/** Peine du delit d'usurpation de plaque — art. L. 317-4-1 du code de la route.
    Utile dans la lettre : le 1° a) de l'art. 529-10 exige le recepisse de plainte
    POUR CE DELIT, pas une main courante. */
export const PEINE_USURPATION_PLAQUE = {
  emprisonnementAnnees: 7,
  amende: 30000,
  article: "art. L. 317-4-1 du code de la route",
  source: SRC_L317_4_1,
  statut: "verifie" as Statut,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Enumerations du domaine
//
// Les tables destinees a un `<select>` sont en `ReadonlyArray<{ id; label;
// aide? }>` : c'est la forme exacte qu'attend la primitive `Liste<T>` du
// composant client, donc une enumeration s'y branche sans adaptateur.
//
// Les tables dont l'EXHAUSTIVITE doit etre garantie a la compilation sont en
// `Readonly<Record<Union, Def>>` : c'est la seule construction qui fasse
// echouer la compilation (TS2741) quand un membre est ajoute a l'union. Une
// annotation `ReadonlyArray<{ id: Voie }>` — et un `satisfies` — ne verifient
// que la VALIDITE des identifiants, jamais leur exhaustivite.
// ─────────────────────────────────────────────────────────────────────────────

/** Les cinq demarches traitees. « opposition-routee » ne produit AUCUN courrier :
    l'opposition a une ordonnance penale se forme par declaration selon les
    modalites notifiees par le greffe, et generer une lettre libre ferait courir
    un risque de forclusion sur un delai de trente jours. */
export type Voie =
  | "exoneration"
  | "designation"
  | "reclamation"
  | "rapo"
  | "opposition-routee";

export type SousBranche =
  | "a1-conducteur"
  | "a2-evenement"
  | "a3-realite"
  | "b1-locataire"
  | "b2-salarie"
  | "b3-impossible"
  | "c1-avis-initial-jamais-recu"
  | "c2-jamais-connaissance"
  | "c3-changement-adresse"
  | "c4-designation-jointe"
  // C3 corrige ici. Les quatre sous-branches de reclamation portaient TOUTES sur
  // la non-reception. Le motif de loin le plus frequent au stade majore — je
  // n'etais pas la, le radar s'est trompe, la signalisation manquait — n'avait
  // aucune branche : l'utilisateur etait pousse soit vers C1, dont le paragraphe
  // fixe affirme « Je n'ai jamais recu l'avis de contravention initial » (une
  // affirmation qu'il n'est peut-etre pas en mesure de faire), soit vers A3,
  // c'est-a-dire une requete en exoneration formee contre un avis d'amende
  // forfaitaire majoree — la confusion de voies que toute la page existe pour
  // dissiper.
  | "c5-realite-majoree"
  | "d1-recours"
  | "z-routage";

/** Nature de l'infraction — elle ne sert QU'A choisir le bon texte de transfert
    de responsabilite vers le locataire. Les confondre est l'erreur type du
    cluster : L121-2 al. 2 pour le stationnement, les peages et les depots
    d'ordures ; L121-3 al. 4 pour les infractions du controle automatique. */
export type NatureInfraction =
  | "controle-automatique"
  | "stationnement-peage-dechets"
  | "autre";

export type ClasseContravention = "1re" | "2e" | "3e" | "4e" | "5e";

/** Stade auquel se trouve l'amende. Le stade commande le montant de la
    consignation et le plancher de l'art. 530-1. */
export type StadeAmende = "minoree" | "forfaitaire" | "majoree" | "maximum-tribunal";

export type Evenement =
  | "vol"
  | "destruction"
  | "usurpation-plaque"
  | "cession"
  | "delegation-conduite"
  | "force-majeure";

export type Personne = "physique" | "morale";

export const NATURES_INFRACTION: ReadonlyArray<{
  id: NatureInfraction;
  label: string;
  aide: string;
}> = [
  {
    id: "controle-automatique",
    label: "Constatée par un appareil de contrôle automatique homologue (radar, feu rouge)",
    aide: "Au sens de l'article L. 130-9 du code de la route, dont le périmètre est fixe par l'article R. 130-11. C'est cette catégorie qui déclenche l'obligation de désigner le conducteur de l'article L. 121-6.",
  },
  {
    id: "stationnement-peage-dechets",
    label: "Stationnement, péage, ou abandon d'ordures, de déchets, de matériaux ou d'objets",
    aide: `Catégorie de l'article L. 121-2 du code de la route. Attention : le stationnement PAYANT non regle n'est plus une infraction depuis le ${DEPENALISATION_STATIONNEMENT.libelle}, c'est un forfait de post-stationnement — regardez l'intitule de votre papier.`,
  },
  {
    id: "autre",
    label: "Autre infraction (constatée par un agent, avec ou sans interception)",
    aide: "Aucun transfert légal de responsabilité pécuniaire vers le locataire n'est prévu pour cette catégorie : les articles L. 121-2 et L. 121-3 ont chacun leur liste.",
  },
];

export const EVENEMENTS: ReadonlyArray<{
  id: Evenement;
  label: string;
  /** Lettre du 1° de l'art. 529-10 CPP a citer, ou null si l'evenement ne
      correspond a AUCUN des quatre documents alternatifs — auquel cas la piece
      ne dispense pas de la consignation dans le champ de 529-10. */
  lettre529_10: "a" | "c" | "d" | null;
  piece: string;
  /** Tournure imprimee dans le courrier, apres « le vehicule a fait l'objet ».
      Elle vit ici et pas dans le gabarit : c'est une donnee de l'enumeration,
      et un gabarit qui accorderait lui-meme le genre finirait par ecrire
      « d'un cession ». */
  tournure: string;
  /** Vrai si l'evenement exonere de l'OBLIGATION DE DESIGNER de l'art. L. 121-6,
      dont le texte ne connait que trois causes : le vol, l'usurpation de plaque
      et tout autre evenement de force majeure. La destruction, la cession et la
      delegation de conduite sont des pieces recevables au sens du 1° de
      l'art. 529-10 mais N'EXONERENT PAS de la designation — les confondre
      exposerait a la contravention de non-designation en croyant s'en preserver. */
  exonereDesignation: boolean;
  aide: string;
}> = [
  {
    id: "vol",
    label: "Vol du véhicule",
    lettre529_10: "a",
    piece: "Récépissé du dépôt de plainte pour vol du véhicule",
    tournure: "d'un vol",
    exonereDesignation: true,
    aide: "Le vol est aussi une cause d'exonération de l'obligation de désigner (art. L. 121-6 du code de la route) et de la redevabilité pécuniaire (art. L. 121-3).",
  },
  {
    id: "destruction",
    label: "Destruction du véhicule",
    lettre529_10: "a",
    piece:
      "Copie de la déclaration de destruction du véhicule établie conformément aux dispositions du code de la route",
    tournure: "d'une destruction",
    exonereDesignation: false,
    aide: "Le 1° a) de l'article 529-10 vise la déclaration de destruction, pas une simple attestation de l'assureur. Attention : la destruction ne figure pas parmi les causes d'exonération de l'obligation de désigner énumérées par l'article L. 121-6.",
  },
  {
    id: "usurpation-plaque",
    label: "Usurpation de plaque d'immatriculation",
    lettre529_10: "a",
    piece:
      "Récépissé du dépôt de plainte pour le délit d'usurpation de plaque d'immatriculation prévu par l'article L. 317-4-1 du code de la route",
    tournure: "d'une usurpation de plaque d'immatriculation",
    exonereDesignation: true,
    aide: `Il faut un dépôt de plainte POUR CE Délit, pas une main courante : c'est ce que le texte exige. L'usurpation de plaque est punie de ${PEINE_USURPATION_PLAQUE.emprisonnementAnnees} ans d'emprisonnement et de ${PEINE_USURPATION_PLAQUE.amende.toLocaleString("fr-FR")} euros d'amende (${PEINE_USURPATION_PLAQUE.article}).`,
  },
  {
    id: "cession",
    label: "Cession du véhicule avant les faits",
    lettre529_10: "c",
    piece:
      "Copies de la déclaration de cession du véhicule et de son accusé d'enregistrement dans le système d'immatriculation des véhicules",
    tournure: "d'une cession",
    exonereDesignation: false,
    aide: "Les DEUX pièces sont exigées par le 1° c) : la déclaration seule ne suffit pas, l'accuse d'enregistrement au SIV doit l'accompagner.",
  },
  {
    id: "delegation-conduite",
    label: "Système de délégation de conduite automatisé active",
    lettre529_10: "d",
    piece:
      "Document attestant qu'un système de délégation de conduite automatisé était activé conformément à ses conditions d'utilisation au moment de l'infraction",
    tournure: "de l'activation d'un système de délégation de conduite automatisé",
    exonereDesignation: false,
    aide: "Document prévu par le 1° d) de l'article 529-10, ajouté pour les véhicules à conduite déléguée.",
  },
  {
    id: "force-majeure",
    label: "Autre événement de force majeure",
    lettre529_10: null,
    piece: "Pièces établissant l'événement de force majeure invoqué",
    tournure: "d'un événement de force majeure",
    exonereDesignation: true,
    aide: "La force majeure exonère de l'obligation de désigner (art. L. 121-6) et de la redevabilité pécuniaire (art. L. 121-2 et L. 121-3), mais elle ne figure PAS parmi les quatre documents du 1° de l'article 529-10 : dans le champ de cet article, elle ne dispense donc pas de la consignation.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Delais
//
// Deux unites coexistent et ne doivent JAMAIS etre uniformisees : le code de
// procedure penale compte en JOURS (45, 30, 15), le CGCT compte en MOIS (1, 3).
// « 1 mois » a compter du 31 janvier ne vaut pas « 30 jours ». Le point de
// depart differe lui aussi : ENVOI pour le penal, NOTIFICATION pour le forfait
// de post-stationnement. C'est le seul delai du lot qui court de la
// notification.
// ─────────────────────────────────────────────────────────────────────────────

export type DelaiId =
  | "paiement-minore"
  | "paiement-forfaitaire"
  | "exoneration"
  | "designation"
  | "reclamation"
  | "forclusion-afm-routiere"
  | "prescription-peine"
  | "opposition"
  | "rapo"
  | "silence-rapo"
  | "tsp"
  | "paiement-fps"
  | "telepaiement-supplementaire";

export type Delai = {
  id: DelaiId;
  /** Intitule court, affiche tel quel dans le tableau des delais de la page. */
  intitule: string;
  unite: "jours" | "mois" | "annees";
  valeur: number;
  /** Point de depart EXACT, redige pour etre recopie dans la prose. La formule
      « date de reception » n'y figure jamais : elle n'a aucun effet juridique et
      son existence dans un formulaire induit l'utilisateur en erreur. */
  pointDeDepart: string;
  article: string;
  source: SourceRef;
  statut: Statut;
  note?: string;
};

/**
 * `Readonly<Record<DelaiId, Delai>>` : ajouter un membre a `DelaiId` sans
 * ajouter son delai fait echouer la compilation. Un delai manquant serait bien
 * pire qu'un delai faux — `calculerEcheance` renverrait `undefined` et
 * l'interface afficherait un tiret la ou une forclusion se joue.
 */
export const DELAIS: Readonly<Record<DelaiId, Delai>> = {
  "paiement-minore": {
    id: "paiement-minore",
    intitule: "Payer au tarif minore",
    unite: "jours",
    valeur: 15,
    pointDeDepart:
      "constatation de l'infraction, ou envoi de l'avis s'il est ultérieurement envoyé",
    article: "art. 529-8 du code de procédure pénale",
    source: SRC_529_8,
    statut: "verifie",
  },
  "paiement-forfaitaire": {
    id: "paiement-forfaitaire",
    intitule: "Payer au tarif forfaitaire",
    unite: "jours",
    valeur: 45,
    pointDeDepart:
      "constatation de l'infraction, ou envoi de l'avis s'il est ultérieurement envoyé",
    article: "art. 529-1 du code de procédure pénale",
    source: SRC_529_1,
    statut: "verifie",
  },
  exoneration: {
    id: "exoneration",
    intitule: "Former une requête en exonération",
    unite: "jours",
    valeur: 45,
    pointDeDepart:
      "même point de départ que le paiement : constatation de l'infraction ou envoi de l'avis — jamais la réception",
    article: "art. 529-2 et 529-1 du code de procédure pénale",
    source: SRC_529_2,
    statut: "verifie",
    note: "L'ANTAI retient en pratique « 45 jours à compter de la date figurant sur votre avis ». Le texte dit « envoi », l'administration dit « date de l'avis » : les deux lectures coïncident sur la date portée sur le document, c'est celle qu'il faut saisir.",
  },
  designation: {
    id: "designation",
    intitule: "Désigner le conducteur (personne morale)",
    unite: "jours",
    valeur: 45,
    pointDeDepart: "envoi OU remise de l'avis d'infraction",
    article: "art. L. 121-6 du code de la route",
    source: SRC_L121_6,
    statut: "verifie",
    note: "Le texte vise l'envoi ou la remise, et depuis la loi du 9 juillet 2025 il parle d'« avis d'infraction » et non plus d'« avis de contravention ».",
  },
  reclamation: {
    id: "reclamation",
    intitule: "Former une réclamation contre une amende forfaitaire majorée",
    unite: "jours",
    valeur: 30,
    pointDeDepart: "envoi de l'avis d'amende forfaitaire majorée",
    article: "art. 530, alinéa 2, du code de procédure pénale",
    source: SRC_530,
    statut: "verifie",
  },
  "forclusion-afm-routiere": {
    id: "forclusion-afm-routiere",
    intitule:
      "Forclusion propre aux contraventions au code de la route dont l'avis majoré a été envoyé en recommandé à l'adresse du certificat d'immatriculation",
    unite: "mois",
    valeur: 3,
    pointDeDepart: "envoi de l'avis d'amende forfaitaire majorée",
    article: "art. 530, alinéa 2, du code de procédure pénale",
    source: SRC_530,
    statut: "verifie",
    note: "Ce n'est PAS un délai de recours de trois mois : c'est une forclusion qui referme la soupape de prescription. Elle ne joue pas si le contrevenant justifie avoir déclaré son changement d'adresse au service d'immatriculation des véhicules avant son expiration.",
  },
  "prescription-peine": {
    id: "prescription-peine",
    intitule: "Prescription de la peine en matière contraventionnelle",
    unite: "annees",
    valeur: 3,
    pointDeDepart: "signature du titre exécutoire par le ministère public",
    article: "art. 133-4 du code pénal, combine à l'art. 530, alinéa 1er, du code de procédure pénale",
    source: SRC_133_4,
    statut: "verifie",
    note: "Tant que la peine n'est pas prescrite, la réclamation reste recevable s'il ne résulte pas d'un acte d'exécution ou de tout autre moyen de preuve que l'intéressé a eu connaissance de l'amende forfaitaire majorée.",
  },
  opposition: {
    id: "opposition",
    intitule: "Former opposition à une ordonnance pénale",
    unite: "jours",
    valeur: 30,
    pointDeDepart:
      "envoi de la lettre de notification — ou connaissance de la condamnation si l'avis de réception n'établit pas la réception",
    article: "art. 527 du code de procédure pénale",
    source: SRC_527,
    statut: "verifie",
  },
  rapo: {
    id: "rapo",
    intitule: "Former le recours administratif préalable obligatoire (forfait de post-stationnement)",
    unite: "mois",
    valeur: 1,
    pointDeDepart: "notification de l'avis de paiement du forfait de post-stationnement",
    article: "art. R. 2333-120-13 du code général des collectivités territoriales",
    source: SRC_R2333_120_13,
    statut: "verifie",
    note: "Seul délai du lot qui court de la Notification et non de l'envoi. Ne pas l'uniformiser avec les délais pénaux.",
  },
  "silence-rapo": {
    id: "silence-rapo",
    intitule: "Silence de l'administration valant rejet du recours",
    unite: "mois",
    valeur: 1,
    pointDeDepart: "réception du recours par la collectivité ou son tiers contractant",
    article: "art. R. 2333-120-13 du code général des collectivités territoriales",
    source: SRC_R2333_120_13,
    statut: "verifie",
  },
  tsp: {
    id: "tsp",
    intitule: "Saisir le tribunal du stationnement payant",
    unite: "mois",
    valeur: 1,
    pointDeDepart:
      "notification du rejet explicite, ou jour où naît le rejet implicite du recours administratif préalable",
    article: "art. R. 2333-120-33 du code général des collectivités territoriales",
    source: SRC_R2333_120_33,
    statut: "verifie",
    // Le meme article pose TROIS reserves que la valeur brute ne porte pas. Les
    // omettre revenait a imprimer, dans un courrier adresse a une collectivite,
    // une regle plus severe que le texte pour un redevable ultramarin ou
    // domicilie a l'etranger, et a taire l'inopposabilite qui protege celui dont
    // la decision de rejet ne mentionne pas les voies de recours.
    note: "Ce délai n'est opposable qu'à la condition d'avoir été mentionné, ainsi que les voies de recours, dans la notification de la décision. Il est augmenté d'un mois pour les personnes qui demeurent en Guadeloupe, en Guyane, à la Martinique, à La Réunion, à Saint-Barthélemy, à Saint-Martin, à Mayotte, à Saint-Pierre-et-Miquelon, en Polynésie française, à Wallis-et-Futuna, en Nouvelle-Calédonie et dans les Terres australes et antarctiques françaises, et de deux mois pour les personnes qui demeurent à l'étranger (art. R. 2333-120-33 du code général des collectivités territoriales).",
  },
  "paiement-fps": {
    id: "paiement-fps",
    intitule: "Payer un forfait de post-stationnement",
    unite: "mois",
    valeur: 3,
    pointDeDepart: "notification de l'avis de paiement",
    article: "art. L. 2333-87, IV, du code général des collectivités territoriales",
    source: SRC_L2333_87,
    statut: "verifie",
    note: `À défaut de paiement dans ce délai, le forfait est majoré de ${Math.round(
      MAJORATION_FPS.taux * 100,
    )} % de son montant impaye restant du, sans pouvoir être inférieur à ${MAJORATION_FPS.plancher} euros (${MAJORATION_FPS.article}).`,
  },
  "telepaiement-supplementaire": {
    id: "telepaiement-supplementaire",
    intitule:
      "Délai supplémentaire pour PAYER par télépaiement automatisé ou timbre dématérialisé",
    unite: "jours",
    valeur: 15,
    pointDeDepart:
      "expiration du délai principal de paiement (art. 529-1, 529-8, 529-9 et 530)",
    article: "art. R. 49-3-1 du code de procédure pénale",
    source: SRC_R49_3_1,
    statut: "verifie",
    note: "Ce délai vaut POUR LE PAIEMENT SEUL. Il n'allonge ni les quarante-cinq jours de la requête en exonération, ni les trente jours de la réclamation. C'est le piège numéro un de ce sujet. Le texte visant aussi l'article 530, il y a bien 30 + 15 jours pour payer une amende forfaitaire majorée par télépaiement.",
  },
};

/** Table de delais destinee a l'affichage, DERIVEE du registre : aucune recopie,
    donc aucun risque qu'un delai ajoute manque au tableau de la page. */
export const LISTE_DELAIS: ReadonlyArray<Delai> = (Object.keys(DELAIS) as DelaiId[]).map(
  (id) => DELAIS[id],
);

// ─────────────────────────────────────────────────────────────────────────────
// Baremes
// ─────────────────────────────────────────────────────────────────────────────

export type MontantSource = {
  montant: number;
  article: string;
  source: SourceRef;
  statut: Statut;
  note?: string;
};

/**
 * Bareme d'une classe de contravention.
 *
 * Les stades ABSENTS sont absents parce qu'ils n'ont pas ete verifies, pas
 * parce qu'ils valent zero : les montants minores et majores des trois
 * premieres classes n'ont pas ete releves a la source. Un `montant: 0` ou un
 * `null` aurait produit un chiffre faux dans un tableau ; l'absence, elle,
 * s'affiche en tiret et se voit.
 */
export type BaremeClasse = {
  classe: ClasseContravention;
  minoree?: MontantSource;
  forfaitaire: MontantSource;
  majoree?: MontantSource;
  maximumTribunal?: MontantSource;
};

export const BAREME_CONTRAVENTIONS: Readonly<Record<ClasseContravention, BaremeClasse>> = {
  "1re": {
    classe: "1re",
    // Pas de ligne « minoree » en 1re classe : l'art. R. 49-9 n'en publie pas.
    // C'est une ABSENCE DE TEXTE, pas un trou de relevé — l'amende forfaitaire
    // minorée de l'art. 529-7 ne vise que les 2e a 5e classes.
    forfaitaire: {
      montant: 11,
      article: "art. R. 49 du code de procédure pénale",
      source: SRC_R49,
      statut: "verifie",
    },
    majoree: {
      montant: 33,
      article: "art. R. 49-7 du code de procédure pénale",
      source: SRC_R49_7,
      statut: "verifie",
    },
    maximumTribunal: {
      montant: 38,
      article: "art. 131-13, 1°, du code pénal",
      source: SRC_131_13,
      statut: "verifie",
    },
  },
  "2e": {
    classe: "2e",
    minoree: {
      montant: 22,
      article: "art. R. 49-9 du code de procédure pénale",
      source: SRC_R49_9,
      statut: "verifie",
    },
    forfaitaire: {
      montant: 35,
      article: "art. R. 49 du code de procédure pénale",
      source: SRC_R49,
      statut: "verifie",
    },
    majoree: {
      montant: 75,
      article: "art. R. 49-7 du code de procédure pénale",
      source: SRC_R49_7,
      statut: "verifie",
    },
    maximumTribunal: {
      montant: 150,
      article: "art. 131-13, 2°, du code pénal",
      source: SRC_131_13,
      statut: "verifie",
    },
  },
  "3e": {
    classe: "3e",
    minoree: {
      montant: 45,
      article: "art. R. 49-9 du code de procédure pénale",
      source: SRC_R49_9,
      statut: "verifie",
    },
    forfaitaire: {
      montant: 68,
      article: "art. R. 49 du code de procédure pénale",
      source: SRC_R49,
      statut: "verifie",
    },
    majoree: {
      montant: 180,
      article: "art. R. 49-7 du code de procédure pénale",
      source: SRC_R49_7,
      statut: "verifie",
    },
    maximumTribunal: {
      montant: 450,
      article: "art. 131-13, 3°, du code pénal",
      source: SRC_131_13,
      statut: "verifie",
    },
  },
  "4e": {
    classe: "4e",
    minoree: {
      montant: 90,
      article: "art. R. 49-9 du code de procédure pénale",
      source: SRC_R49_9,
      statut: "verifie",
    },
    forfaitaire: {
      montant: 135,
      article: "art. R. 49 du code de procédure pénale",
      source: SRC_R49,
      statut: "verifie",
    },
    majoree: {
      montant: 375,
      article: "art. R. 49-7 du code de procédure pénale",
      source: SRC_R49_7,
      statut: "verifie",
    },
    maximumTribunal: {
      montant: 750,
      article: "art. 131-13, 4°, du code pénal",
      source: SRC_131_13,
      statut: "verifie",
    },
  },
  "5e": {
    classe: "5e",
    minoree: {
      montant: 150,
      article: "art. R. 49-9 du code de procédure pénale",
      source: SRC_R49_9,
      statut: "verifie",
    },
    forfaitaire: {
      montant: 200,
      article: "art. R. 49 du code de procédure pénale",
      source: SRC_R49,
      statut: "verifie",
      note: "Le montant forfaitaire de 5e classe ne s'applique qu'aux contraventions que l'article R. 48-1 du code de procédure pénale soumet à la procédure de l'amende forfaitaire.",
    },
    majoree: {
      montant: 450,
      article: "art. R. 49-7 du code de procédure pénale",
      source: SRC_R49_7,
      statut: "verifie",
    },
    maximumTribunal: {
      montant: 1500,
      article: "art. 131-13, 5°, du code pénal",
      source: SRC_131_13,
      statut: "verifie",
    },
  },
};

/**
 * Table des classes destinee au `<select>` — DERIVEE du bareme.
 *
 * Elle est declaree ici, apres le bareme, et non dans le bloc des enumerations :
 * son aide contient un montant, et un montant recopie dans une chaine d'aide est
 * un second exemplaire du bareme, qui divergera le jour ou l'article R. 49 sera
 * modifie. Le prix de l'inversion est une entorse a l'ordre canonique des blocs ;
 * le prix de la recopie serait un chiffre faux affiche sous un libelle juste.
 */
export const CLASSES_CONTRAVENTION: ReadonlyArray<{
  id: ClasseContravention;
  label: string;
  aide: string;
}> = (["1re", "2e", "3e", "4e", "5e"] as const).map((id) => {
  // La reserve propre a la 5e classe est LUE dans `forfaitaire.note`, jamais
  // recopiee : la version recopiee ici et la version canonique du bareme
  // auraient diverge, et c'est la canonique qui etait morte.
  const note = BAREME_CONTRAVENTIONS[id].forfaitaire.note;
  const complement =
    id === "4e"
      ? " C'est la classe de la plupart des excès de vitesse, du franchissement de feu rouge et de la contravention de non-désignation du conducteur."
      : note
        ? ` ${note}`
        : "";
  return {
    id,
    label: `Contravention de ${id} classe`,
    aide: `Amende forfaitaire de ${BAREME_CONTRAVENTIONS[id].forfaitaire.montant} euros (${BAREME_CONTRAVENTIONS[id].forfaitaire.article}).${complement}`,
  };
});

/** Verbatim releve a la source le 4 aout 2026 sur LEGIARTI000006576861. */
export const VERBATIM_529_7 =
  "« Pour les contraventions au code de la route des deuxième, troisième, quatrième et cinquième classes dont la liste est fixée par décret en Conseil d'État, à l'exception de celles relatives au stationnement, l'amende forfaitaire est minorée si le contrevenant en règle le montant dans les conditions prévues par l'article 529-8. »";

/**
 * Note editoriale rattachee au bareme. Le statut passe de « deduit » a
 * « verifie » : le verbatim a ete recopie a la source.
 *
 * Ce qui bloquait n'etait pas la regle, c'etait une ERREUR D'IDENTIFIANT. La
 * source citee pointait sur LEGIARTI000006576859, qui est l'article 529-6 et
 * non l'article 529-7 : la page ouverte parlait de peage autoroutier, le
 * verbatim etait donc introuvable et le point restait ouvert pour rien. Ouvert
 * au bon identifiant, l'article 529-7 dit exactement ce que la note affirmait.
 */
export const NOTE_MINOREE_STATIONNEMENT = {
  texte:
    "Il n'y a pas d'amende forfaitaire minorée en matière de stationnement : le tarif minoré récompense un paiement rapide sur les infractions relevant du régime de l'article 529-1, pas sur celles de l'article 529-7.",
  article: "art. 529-7 du code de procédure pénale",
  source: SRC_529_7,
  statut: "verifie" as Statut,
  note: VERBATIM_529_7,
};


/**
 * Quintuplement des amendes forfaitaires applicables a une personne morale.
 *
 * Le facteur est le meme pour les trois stades forfaitaires (530-3 al. 2 CPP) et
 * pour le maximum encouru devant le tribunal de police (131-41 CP), mais le
 * FONDEMENT differe : imprimer le mauvais article sur une piece adressee a
 * l'administration est exactement le genre de faute qu'on ne se pardonne pas.
 */
export const QUINTUPLEMENT_PERSONNE_MORALE = {
  facteur: 5,
  articleForfaitaire: "art. 530-3, alinéa 2, du code de procédure pénale",
  sourceForfaitaire: SRC_530_3,
  articleMaximum: "art. 131-41 du code pénal",
  sourceMaximum: SRC_131_41,
  statut: "verifie" as Statut,
} as const;

/**
 * Etiquette OBLIGATOIRE de tout montant issu du bareme de non-designation.
 *
 * Interdiction absolue heritee de la note de cadrage : ne jamais afficher 675
 * euros en face d'un exces de vitesse. Les 675 euros sont le prix de l'OUBLI DE
 * DESIGNATION, jamais celui de l'infraction constatee par le radar. L'etiquette
 * voyage avec le montant pour que l'interface ne puisse pas les separer, et
 * `verifierContestation()` echoue si le libelle cesse de nommer la
 * non-designation.
 */
export const ETIQUETTE_NON_DESIGNATION = "non-designation" as const;

export type MontantEtiquete = {
  montant: number;
  etiquette: typeof ETIQUETTE_NON_DESIGNATION;
  libelle: string;
  article: string;
  source: SourceRef;
  statut: Statut;
};

/**
 * Bareme informatif — structurellement inutilisable par le moteur.
 *
 * Meme role que `TRAJECTOIRE_2027` dans `tvs.ts` : une donnee non fiabilisee ne
 * se declare pas avec un statut « non verifie » dans le type calculable, elle se
 * declare dans un type INCOMPATIBLE. Ici, `montants: null` n'est pas une
 * commodite : c'est le verrou. `verifierContestation()` echoue si ce champ cesse
 * d'etre nul tant que le point `verbatim-r48-1` figure dans POINTS_A_LEVER.
 */
export type BaremeInformatif = {
  intitule: string;
  statut: "non-verifie";
  montants: null;
  article: string;
  source: SourceRef;
  detail: string;
  /** Identifiant du point de POINTS_A_LEVER qui verrouille la publication. */
  pointALever: string;
};

export const BRANCHE_DELIT_NON_DESIGNATION: BaremeInformatif = {
  intitule:
    "Non-designation lorsque l'infraction-source est un délit : amende de la cinquième classe",
  statut: "non-verifie",
  montants: null,
  article: "dernier alinéa de l'art. L. 121-6 du code de la route ; art. R. 48-1, II, 7°, du code de procédure pénale",
  source: SRC_R48_1,
  detail:
    "Depuis la loi du 9 juillet 2025, la non-désignation est punie de l'amende de la cinquième classe lorsque l'infraction-source est un délit — ce qui est devenu possible le 29 décembre 2025, le très grand excès de vitesse étant devenu un délit. L'article R. 48-1, II, 7°, du code de procédure pénale vise nommement le dernier alinéa de l'article L. 121-6, ce qui forfaitise cette branche. Aucun montant n'est publié ici tant que le verbatim de cette énumération, très récente et lue par l'intermédiaire d'un résumé automatique, n'a pas été recopié directement.",
  pointALever: "verbatim-r48-1",
};

/**
 * Les quatre documents alternatifs du 1° de l'art. 529-10 et la consignation du
 * 2°. C'est une ALTERNATIVE, jamais un cumul : produire l'un des documents du 1°
 * DISPENSE de consigner. La SERP est pleine de pages qui font croire l'inverse.
 */
export const PIECES_529_10: ReadonlyArray<{
  id: string;
  reference: string;
  intitule: string;
  dispenseDeConsignation: boolean;
}> = [
  {
    id: "1a",
    reference: "529-10, 1° a)",
    intitule:
      "Récépissé du dépôt de plainte pour vol ou destruction du véhicule ou pour le délit d'usurpation de plaque d'immatriculation, ou copie de la déclaration de destruction du véhicule",
    dispenseDeConsignation: true,
  },
  {
    id: "1b",
    reference: "529-10, 1° b)",
    intitule:
      "Lettre signée de l'auteur de la requête ou de la réclamation précisant l'identité, l'adresse ainsi que la référence du permis de conduire de la personne qui était présumée conduire le véhicule",
    dispenseDeConsignation: true,
  },
  {
    id: "1c",
    reference: "529-10, 1° c)",
    intitule:
      "Copies de la déclaration de cession du véhicule et de son accuse d'enregistrement dans le système d'immatriculation des véhicules",
    dispenseDeConsignation: true,
  },
  {
    id: "1d",
    reference: "529-10, 1° d)",
    intitule:
      "Document attestant qu'un système de délégation de conduite automatisée était active conformément à ses conditions d'utilisation au moment de l'infraction",
    dispenseDeConsignation: true,
  },
  {
    id: "2",
    reference: "529-10, 2°",
    intitule:
      "Document démontrant qu'il a été acquitte une consignation préalable d'un montant égal à celui de l'amende forfaitaire ou à celui de l'amende forfaitaire majorée",
    dispenseDeConsignation: false,
  },
];

/**
 * Ce que la consignation N'EST PAS. Cite VERBATIM, jamais paraphrase : c'est la
 * peur numero un du lecteur, et une paraphrase la reveillerait au lieu de
 * l'eteindre.
 */
export const VERBATIM_CONSIGNATION =
  "cette consignation n'est pas assimilable au paiement de l'amende forfaitaire et ne donne pas lieu au retrait des points du permis de conduire";

/**
 * IMPUTATION DE LA CONSIGNATION sur l'amende prononcee en cas de condamnation.
 *
 * Aucun texte lu ne la prevoit. Tant que `publie` vaut false, aucun montant net
 * n'est calcule NULLE PART dans ce module — `plancherCondamnation()` renvoie le
 * plancher brut et porte une note qui dit explicitement que la consignation n'en
 * est pas deduite. `verifierContestation()` echoue si `publie` passe a true sans
 * que le point `imputation-consignation` ait ete retire de POINTS_A_LEVER : le
 * blocage est MECANIQUE, il ne repose pas sur la vigilance d'un relecteur.
 */
export const IMPUTATION_CONSIGNATION = {
  publie: false,
  detail:
    "La consignation est reversée en cas de classement sans suite ou de relaxe. Aucun texte lu ne dit qu'elle s'impute sur l'amende prononcée en cas de condamnation : ce module ne calcule donc aucun montant net, et la phrase « la consignation est déduite de l'amende » ne doit apparaître nulle part.",
  pointALever: "imputation-consignation",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Notes editoriales exportees — tout texte consomme A LA FOIS par la page et par
// le document imprime vit ici. Une regle ecrite a deux endroits finit toujours
// par se contredire d'un feuillet a l'autre.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mention deontologique. Art. 54 de la loi n° 71-1130 du 31 decembre 1971 : nul
 * ne peut, a titre habituel et remunere, donner des consultations juridiques ou
 * rediger des actes sous seing prive pour autrui sans titre. Cette mention est
 * imprimee A LA FOIS a l'ecran et en pied du document genere — c'est une
 * exigence de fond, pas un pied de page decoratif.
 */
export const MENTION_DEONTOLOGIQUE =
  "Lexio édite un logiciel de gestion pour loueurs de véhicules. Ce document est un modèle de courrier généré automatiquement à partir des informations que vous avez saisies : il ne constitue ni une consultation juridique, ni un conseil personnalisé, et il ne remplace pas le formulaire joint à votre avis. Les montants, délais et références légales sont ceux en vigueur à la date de mise à jour indiquée. Pour une situation complexe, consultez un avocat.";

export const CONVENTIONS = {
  triSurLePapier:
    "Le tri entre les recours ne se fait jamais sur le motif de contestation, ni sur le montant, ni sur la nature des faits : il se fait sur l'intitulé imprimé du papier reçu. Un même stationnement peut relever du forfait de post-stationnement (redevance) ou d'une contravention (gênant, très gênant, dangereux, abusif) — c'est le papier qui tranche.",
  envoiPasReception:
    "Les délais pénaux courent de l'ENVOI de l'avis, jamais de sa réception. La date à saisir est la date d'envoi portée sur l'avis ; aucun champ « date de réception » n'est proposé, parce qu'il n'a aucun effet juridique et qu'il ferait compter le délai à partir de la mauvaise date.",
  // L'exemple chiffre de cette convention n'est PAS ecrit ici : il est calcule
  // par `EXEMPLE_COMPTAGE`, plus bas, avec les vraies fonctions de calendrier.
  // Un exemple recopie a la main est un endroit de plus ou la regle peut mentir.
  comptageJours:
    "Un délai en jours est ajouté à la date de départ. Un délai en mois tombe le même quantième du mois d'arrivée, ramené au dernier jour du mois lorsque ce quantième n'existe pas : un avis notifié le 31 janvier ouvre un délai d'un mois qui expire le dernier jour de février, pas le 3 mars.",
  destinataireJamaisPrerempli:
    "Aucune adresse de destination n'est pré-remplie : elle depend du service emetteur et figure sur l'avis. Envoyer au mauvais destinataire ne suspend aucun délai.",
  numeroDeCasNonImprime:
    "Le courrier n'imprime jamais de numéro de cas (« CAS N° 1 », « CAS N° 2 ») : ce vocabulaire est celui des cases du formulaire joint à l'avis, il ne constitue pas une taxonomie légale. Le courrier imprime le fondement légal ; c'est l'interface qui invite à cocher la case correspondante sur le formulaire officiel.",
  documentAccompagnement:
    "Dans le champ de l'article 529-10, le courrier généré est une LETTRE D'ACCOMPAGNEMENT : le formulaire joint à l'avis reste obligatoire et n'est pas substituable. L'outil ne produit aucun formulaire officiel et ne se présente jamais comme un Cerfa.",
} as const;

/** Effet du paiement — art. L. 223-1 du code de la route et art. 529 du code de
    procedure penale. La nuance est essentielle : le texte parle de la REALITE DE
    L'INFRACTION pour l'application du permis a points, pas d'une reconnaissance
    de culpabilite penale. */
export const NOTE_PAIEMENT = {
  texte:
    "Payer, c'est reconnaître. Le paiement de l'amende forfaitaire éteint l'action publique — il n'y a donc plus rien à contester — et il établit la réalité de l'infraction au sens de l'article L. 223-1 du code de la route, ce qui déclenche le retrait de points lorsque l'infraction en entraîne un. Au stade majoré, la même phrase vise l'émission du titre exécutoire : la réalité de l'infraction est alors déjà établie sans aucun paiement.",
  article: "art. L. 223-1 du code de la route",
  source: SRC_L223_1,
  statut: "verifie" as Statut,
};

/** Branche non generee : opposition a ordonnance penale. L'outil ROUTE, il ne
    redige pas. Une lettre libre exposerait a une forclusion de trente jours. */
export const NOTE_ROUTAGE_ORDONNANCE_PENALE = {
  texte:
    "Ce n'est pas une amende majorée : une ordonnance pénale a déjà été rendue. La voie n'est plus la réclamation de l'article 530 mais l'opposition de l'article 527 du code de procédure pénale, à former dans les trente jours selon les modalités indiquées sur la notification. L'opposition ne se forme pas par une lettre libre, mais par déclaration selon ces modalités. Le comptable public arrête le recouvrement dès réception de l'avis d'opposition établi par le greffe.",
  article: "art. 527 du code de procédure pénale",
  source: SRC_527,
  statut: "verifie" as Statut,
};

/** La voie dematerialisee existe, elle est recevable de plein droit et elle
    dispense des frais de recommande. Ne pas vendre le courrier comme la seule
    voie : ce serait faux, et la SERP est tenue par l'ANTAI, qui dit le
    contraire. */
export const VOIES_DEMATERIALISEES: ReadonlyArray<{
  id: string;
  intitule: string;
  pourQui: string;
  url: string;
  pieces?: string;
}> = [
  {
    id: "usagers",
    intitule: "Téléservice usagers de l'ANTAI, désignation ou contestation à l'unité",
    pourQui:
      "particulier, entrepreneur individuel, représentant légal, petite flotte — saisie du numéro d'avis",
    url: "https://www.usagers.antai.gouv.fr/demarches/saisienumero",
  },
  {
    id: "flotte",
    intitule: "Espace gestionnaire de flotte de l'ANTAI, désignation en masse",
    pourQui: "flottes de plus de dix véhicules, plusieurs conducteurs désignés à la fois",
    url: "https://entreprises.antai.gouv.fr/",
    pieces:
      "Ouverture conditionnée à un avis de contravention adressé à la personne morale datant d'au moins un mois, à un extrait Kbis ou certificat d'inscription au RCS, et à une déclaration du représentant légal pour l'usage du service. C'est ce qui explique que la voie papier reste la seule disponible en urgence.",
  },
];

export const MOTIFS_RECEVABLES: ReadonlyArray<{ id: string; label: string; aide: string }> = [
  {
    id: "signalisation",
    label: "Signalisation absente, contradictoire ou masquée",
    aide: "Motif de fait, vérifiable : photographies datées, relevé de la signalisation en place le jour des faits.",
  },
  {
    id: "vehicule-non-identifiable",
    label: "Véhicule non identifiable sur le cliche",
    aide: "Demandez la communication du cliche : c'est une pièce de la procédure.",
  },
  {
    id: "plaque-usurpee",
    label: "Plaque d'immatriculation usurpée",
    aide: "Suppose un dépôt de plainte pour le délit de l'article L. 317-4-1 du code de la route, et non une main courante.",
  },
  {
    id: "erreur-materielle",
    label: "Erreur matérielle sur l'avis : plaque, marque, lieu, date ou heure",
    aide: "Comparez chaque mention de l'avis avec le certificat d'immatriculation.",
  },
  {
    id: "cede-vole",
    label: "Véhicule cédé ou volé à la date des faits",
    aide: "Déclaration de cession et accusé d'enregistrement au SIV, ou récépissé de dépôt de plainte.",
  },
  {
    id: "loue",
    label: "Véhicule loué à un tiers identifié",
    aide: "La loi désigne le locataire comme redevable pécuniaire : article L. 121-2, alinéa 2, pour le stationnement, les péages et les dépôts de déchets, article L. 121-3, alinéa 4, pour les infractions du contrôle automatique.",
  },
  {
    id: "fps-paye",
    label: "Forfait de post-stationnement : redevance déjà payée ou horodateur en panne",
    aide: "Justificatif de paiement, photographie de l'appareil hors service, attestation de la collectivité.",
  },
];

export const MOTIFS_IRRECEVABLES: ReadonlyArray<{ id: string; label: string; aide: string }> = [
  {
    id: "bonne-foi",
    label: "La bonne foi",
    aide: "Elle n'est pas un moyen : elle ne se prouve pas et ne contredit aucun élément de l'infraction.",
  },
  {
    id: "urgence",
    label: "L'urgence non caractérisée",
    aide: "Une urgence invoquée sans pièce ne constitue pas la force majeure.",
  },
  {
    id: "absence-de-gene",
    label: "L'absence de gêne réellement constatée",
    aide: "L'infraction de stationnement gênant ne suppose pas la preuve d'une gêne effective.",
  },
  {
    id: "duree-courte",
    label: "La durée courte du stationnement",
    aide: "Écrire « je n'étais là que cinq minutes » reconnaît le stationnement et le situe dans le temps.",
  },
];

/** Les onze causes de rejet les plus frequentes. Affichees comme garde-fous dans
    l'interface : une lettre irrecevable coute le meme delai qu'une lettre non
    envoyee, mais fait croire que le dossier est parti. */
export const MOTIFS_REJET: ReadonlyArray<{ id: string; label: string; detail: string }> = [
  {
    id: "lettre-simple",
    label: "Lettre simple alors que l'article 529-10 s'applique",
    detail:
      "Dans le champ de cet article, la requête ou la réclamation n'est recevable que si elle est adressée par lettre recommandée avec demande d'avis de réception, ou par la voie dématérialisée prévue par son dernier alinéa.",
  },
  {
    id: "afm-non-jointe",
    label: "Avis d'amende forfaitaire majorée non joint à la réclamation",
    detail:
      "L'alinéa 3 de l'article 530 le prévoit expressément : à défaut, la réclamation est irrecevable.",
  },
  {
    id: "formulaire-non-utilise",
    label: "Formulaire joint à l'avis non utilise dans le champ de l'article 529-10",
    detail: "Le formulaire joint à l'avis n'est ni substituable ni téléchargeable.",
  },
  {
    id: "non-motivee",
    label: "Réclamation non motivée",
    detail:
      "Le ministère public peut aviser l'intéressé de l'irrecevabilité de la réclamation non motivée ou non accompagnée de l'avis (art. 530-1).",
  },
  {
    id: "designation-incomplete",
    label: "Désignation incomplète : identité et adresse sans référence du permis de conduire",
    detail:
      "L'article L. 121-6 exige l'identité et l'adresse ; le 1° b) de l'article 529-10 exige en plus la référence du permis. C'est la première cause de rejet chez un loueur, et elle se joue à la remise des clés, pas au moment du courrier.",
  },
  {
    id: "sans-piece-sans-consignation",
    label: "Contester sans pièce et sans consigner, dans le champ de l'article 529-10",
    detail: "L'alternative du 1° et du 2° n'admet pas de troisième terme.",
  },
  {
    id: "designer-et-contester",
    label: "Désigner et contester la réalité de l'infraction dans le même courrier",
    detail:
      "Les deux branches sont exclusives : la première transfère le dossier au conducteur, la seconde demande l'abandon de la poursuite.",
  },
  {
    id: "hors-delai",
    label: "Hors délai, parce que le délai a été compté depuis la réception",
    detail: "Les délais pénaux courent de l'envoi.",
  },
  {
    id: "mauvais-destinataire",
    label: "Mauvais destinataire",
    detail:
      "Un recours contre un forfait de post-stationnement adressé à l'ANTAI, ou une requête en exonération adressée à la mairie, ne suspendent aucun délai.",
  },
  {
    id: "rapo-incomplet",
    label:
      "Recours contre un forfait de post-stationnement sans copie du certificat d'immatriculation ou sans exposé des moyens",
    detail: "L'article R. 2333-120-13 les exige à peine d'irrecevabilité.",
  },
  {
    id: "avoir-paye",
    label: "Avoir payé d'abord",
    detail:
      "Le paiement éteint l'action publique et établit la réalité de l'infraction : il n'y a plus rien à contester.",
  },
];

/**
 * LISTE NOIRE des formulations qui valent aveu ou qui ruinent la branche
 * choisie. Elle sert a DEUX choses : le generateur ne produit jamais ces
 * phrases, et il les DETECTE dans les champs libres de l'utilisateur.
 * Les expressions sont ecrites en minuscules sans accent : la detection
 * normalise les deux cotes (voir `normaliserTexte`).
 */
export const FORMULATIONS_INTERDITES: ReadonlyArray<{
  expression: string;
  motif: string;
}> = [
  { expression: "je reconnais avoir", motif: "aveu de l'élément matériel de l'infraction" },
  { expression: "il est vrai que je", motif: "aveu de l'élément matériel de l'infraction" },
  { expression: "je regrette d'avoir", motif: "aveu de l'élément matériel de l'infraction" },
  {
    expression: "cinq minutes",
    motif: "reconnaît le stationnement et le situe dans le temps",
  },
  {
    expression: "je ne conteste pas les faits",
    motif: "ferme la branche « réalité de l'infraction »",
  },
  {
    expression: "j'ai payé",
    motif:
      "le paiement éteint l'action publique (art. 529) et établit la réalité de l'infraction (art. L. 223-1 du code de la route)",
  },
  {
    expression: "je suis de bonne foi",
    motif: "motif non recevable, jamais suffisant seul",
  },
  {
    expression: "je n'étais pas au courant",
    motif: "motif non recevable en l'absence de pièce",
  },
  {
    expression: "c'était une urgence",
    motif: "une urgence non caractérisée ne constitue pas la force majeure",
  },
  {
    expression: "devait être",
    motif:
      "une désignation imprécise est une désignation nulle au sens de l'article L. 121-6 et du 1° b) de l'article 529-10",
  },
  {
    expression: "un de mes clients",
    motif:
      "une désignation imprécise est une désignation nulle au sens de l'article L. 121-6 et du 1° b) de l'article 529-10",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// POINTS A LEVER
//
// Traites comme des defauts de livraison, pas comme des details. La liste est
// exportee pour etre rendue telle quelle dans la methodologie de la page — un
// point ouvert affiche vaut mieux qu'un point ouvert oublie.
//
// AUCUN point n'est marque `bloquant: true`, et ce n'est pas une facilite : les
// deux points que la note de cadrage declarait bloquants SOUS CONDITION
// (« oui si un montant net est affiche », « oui pour la branche delit ») ont vu
// leur condition rendue STRUCTURELLEMENT inatteignable —
// `IMPUTATION_CONSIGNATION.publie === false` et
// `BRANCHE_DELIT_NON_DESIGNATION.montants === null` — et
// `verifierContestation()` echoue si l'un des deux verrous saute alors que le
// point correspondant est encore ouvert. Le blocage est donc mecanique et porte
// sur la condition reelle, au lieu d'interdire la publication d'une page dont
// aucun element fautif n'est affiche.
// ─────────────────────────────────────────────────────────────────────────────

export const POINTS_A_LEVER: ReadonlyArray<{
  id: string;
  intitule: string;
  detail: string;
  bloquant: boolean;
}> = [
  {
    id: "imputation-consignation",
    intitule: "Imputation de la consignation sur l'amende prononcée en cas de condamnation",
    detail:
      "Aucun texte lu ne prévoit que la consignation s'impute sur l'amende prononcée. Le module ne calcule donc aucun montant net et n'affiche que ce qui est établi : la consignation est reversée en cas de classement sans suite ou de relaxe. Verrou : IMPUTATION_CONSIGNATION.publie doit rester false, le contrôle « imputation-consignation » casse le build sinon.",
    bloquant: false,
  },
  {
    id: "verbatim-r48-1",
    intitule:
      "Verbatim de l'article R. 48-1, II, 7°, du code de procédure pénale (version du 30 juillet 2026)",
    detail:
      "L'énumération a été lue par l'intermédiaire d'un résumé automatique et sa version est très récente. Aucun montant forfaitaire de cinquième classe n'est donc publié pour la branche délit de la non-désignation. Verrou : BRANCHE_DELIT_NON_DESIGNATION.montants doit rester null, le contrôle « branche-delit-verrouillee » casse le build sinon.",
    bloquant: false,
  },
  // Point LEVE le 4 août 2026, et conservé ici pour mémoire du défaut qui le
  // maintenait ouvert : la source citée portait l'identifiant Légifrance
  // LEGIARTI000006576859, qui est celui de l'article 529-6 (transaction pour
  // non-paiement du péage autoroutier). Le verbatim était donc introuvable
  // parce que la mauvaise page était ouverte. Au bon identifiant
  // (LEGIARTI000006576861), l'article 529-7 dit exactement ce que la note
  // affirmait, et la note est passée au statut « vérifié ».
  {
    id: "bareme-classes-1-a-3",
    intitule: "Montants minorés et majorés des trois premières classes",
    detail:
      "Ces montants ont été relevés à la source le 4 août 2026 : art. R. 49-7 pour les majorées (33 €, 75 €, 180 €) et art. R. 49-9 pour les minorées (22 € en 2e classe, 45 € en 3e). Le point ouvert n'est plus le relevé mais le PÉRIMÈTRE : l'article R. 49-9 ne publie aucun montant minoré de 1re classe, parce que l'amende forfaitaire minorée de l'article 529-7 ne vise que les 2e à 5e classes. Le tiret affiché sur cette ligne est donc une absence de texte, non un trou de relevé — et le tableau ne le distingue pas encore d'un montant manquant.",
    bloquant: false,
  },
  {
    id: "responsabilite-penale-personne-morale",
    intitule: "Responsabilité pénale de la personne morale pour la non-désignation",
    detail:
      "L'arrêt Cass. crim. 11 décembre 2018, n° 18-82.820 juge que le libellé de l'avis au nom de la personne morale est indifférent ; il ne pose pas en règle que la personne morale est pénalement responsable de la non-désignation. Le module cite donc l'article 530-3, alinéa 2, pour le quintuplement, sans affirmer à qui l'avis est libellé, et source le barème 450 / 675 / 1 875 euros sur la page ANTAI qui le publie.",
    bloquant: false,
  },
  {
    id: "cas-n1-antai",
    intitule: "Présence de la mention « CAS N° 1 » sur la page de l'ANTAI",
    detail:
      "Divergence non tranchée entre deux lectures de la même page le même jour. Sans effet ici : le générateur n'imprime jamais de numéro de cas dans le courrier, il imprime le fondement légal (convention « numeroDeCasNonImprime »).",
    bloquant: false,
  },
  {
    id: "verbatim-l121-6",
    intitule: "Verbatim intégral du premier alinéa de l'article L. 121-6 du code de la route",
    detail:
      "Le verbatim retenu est celui figé à la source le 2 août 2026 ; la relecture du 3 août est passée par un résumé automatique. Aucun montant n'en depend — l'article n'en contient aucun — mais le verbatim doit être recopié une fois depuis Legifrance avant toute citation entre guillemets dans la prose.",
    bloquant: false,
  },
  {
    id: "points-representant-legal-stationnement",
    intitule:
      "Retrait de points du représentant légal sur une contravention de stationnement",
    detail:
      "Non vérifié. Le module n'écrit donc rien sur ce point : ni « le représentant légal ne perd pas de points », ni l'inverse. Seule affirmation retenue : le stationnement dangereux entraîne un retrait de points, les autres contraventions de stationnement n'en entraînent pas.",
    bloquant: false,
  },
  {
    id: "frais-fourriere",
    intitule: "Sort des frais de fourrière en cas d'annulation de la contravention",
    detail:
      "Les articles L. 325-1 à L. 325-3 du code de la route n'ont pas été ouverts. Aucun montant de fourrière, aucune règle d'imputation ne figure dans ce module.",
    bloquant: false,
  },
  {
    id: "renommage-tsp",
    intitule: "Date du renommage de la commission du contentieux du stationnement payant",
    detail:
      "Le décret n° 2024-733 du 5 juillet 2024 n'a pas été ouvert. Le module emploie « tribunal du stationnement payant » et mentionné une fois l'ancienne dénomination, sans dater le changement de nom.",
    bloquant: false,
  },
  {
    id: "entrepreneur-individuel",
    intitule: "Champ de l'article L. 121-6 pour un entrepreneur individuel",
    detail:
      "Sujet à forte valeur pour l'audience — beaucoup de petits loueurs sont en entreprise individuelle — mais jurisprudentiel et non sourçable en l'état. Le module s'en tient au deuxième alinéa de l'article L. 121-6, qui vise les personnes physiques ayant immatriculé le véhicule en tant que personne morale, sans extrapoler.",
    bloquant: false,
  },
  {
    id: "droit-fixe-procedure",
    intitule: "Montant du droit fixe de procédure (art. 1018 A du code général des impôts)",
    detail:
      "Le barème n'a pas été ouvert. Le module mentionné l'existence de ce droit, sans aucun montant : les chiffres qui circulent correspondent à des lignes qui ne sont pas celles de l'ordonnance pénale contraventionnelle.",
    bloquant: false,
  },
  {
    id: "arrete-voie-dematerialisee",
    intitule:
      "Arrêté d'application de la voie dématérialisée prévue au dernier alinéa de l'article 529-10",
    detail:
      "L'arrêté n'a pas été identifié. Le module écrit que la voie dématérialisée est prévue par le texte et mise en oeuvre par le parcours en ligne de l'ANTAI, sans citer de référence d'arrêté.",
    bloquant: false,
  },
  {
    id: "abrogation-2029",
    intitule:
      "Abrogation programmée au 1er janvier 2029 des articles 527, 529-1, 529-2, 529-10, 530, 530-1 et 530-3 du code de procédure pénale",
    detail:
      "Ordonnance n° 2025-1091 du 19 novembre 2025. Sans effet en 2026. Revue à programmer avant la fin de 2028 : les versions consolidées citées ici portent toutes la mention « jusqu'au 1er janvier 2029 ».",
    bloquant: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Formatage — redeclare localement, jamais importe de tvs.ts ni de
// contrat-location.ts (deux modules de donnees ne se rendent pas dependants
// l'un de l'autre pour trois lignes de mise en forme).
// ─────────────────────────────────────────────────────────────────────────────

/** Montant arrondi a l'euro, forme de tous les baremes affiches. */
export const eur = (v: number): string =>
  `${Math.round(v).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;

/** Montant au centime : reserve au plancher de l'article 530-1, ou masquer les
    decimales rendrait le calcul incontrolable (135 € + 10 % = 148,50 €). */
export const eurPrecis = (v: number): string =>
  `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Valeur saisie, ou pointilles a completer a la main.
 *
 * `largeur` compte des CARACTERES imprimes : on repete « . » et non « … », dont
 * le caractere unique occupe la place de trois points et fait exploser la mise
 * en page d'un courrier. C'est ce qui rend les specimens directement
 * imprimables : un gabarit vide reste un document utilisable au stylo.
 */
export const val = (x: string | undefined, largeur = 20): string =>
  (x ?? "").trim() || ".".repeat(largeur);

/** Date ISO -> date francaise en toutes lettres. Chaîne vide ou date invalide ->
    pointilles, jamais « Invalid Date » sur une piece adressee a
    l'administration. « 1er janvier » et non « 1 janvier » : Intl ne fait pas
    l'ordinal pour fr-FR. */
export const dateFr = (iso: string | undefined, largeur = 18): string => {
  if (!iso) return ".".repeat(largeur);
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ".".repeat(largeur);
  const s = d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return s.startsWith("1 ") ? `1er ${s.slice(2)}` : s;
};

/** Heure « HH:MM » d'un champ `input type="time"` -> « 14 h 32 », la forme des
    pieces formelles francaises. « à 14:32 » est une notation d'ecran, pas une
    notation de correspondance. Chaîne vide ou illisible -> meme repli que `val`
    (pointilles a completer au stylo). */
export const heureFr = (h: string): string => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h.trim());
  return m ? `${Number(m[1])} h ${m[2]}` : val(h, 5);
};

/** Libelle d'une valeur d'enumeration. Repli sur l'identifiant : un libelle
    manquant doit se voir, pas disparaître. */
export const libelleDe = <T extends string>(
  table: ReadonlyArray<{ id: T; label: string }>,
  id: T,
): string => table.find((x) => x.id === id)?.label ?? String(id);

// `libelleNature`, `libelleClasse` et `libelleEvenement` ont ete supprimees :
// aucune n'avait d'appelant, ni dans le module, ni dans la page, ni dans le
// composant. `libelleDe`, dont elles derivaient, reste consommee.
/** `""` = aucun evenement choisi. La valeur vide n'est PAS un membre de
    `Evenement` : elle ne peut donc jamais etre confondue avec un evenement reel
    dans un `switch`, et le gabarit qui ne la trouve pas imprime des pointilles
    au lieu de supposer un vol. */
export const evenementDe = (e: Evenement | "") =>
  e === "" ? undefined : EVENEMENTS.find((x) => x.id === e);

/**
 * GARDE D'EXHAUSTIVITE. Appelee avec une valeur que le typage rend impossible,
 * elle ne compile que si TOUS les membres de l'union ont ete traites en amont.
 * Aucun `default` ni `else` fourre-tout dans ce module : un repli silencieux
 * imprimerait la mauvaise base legale sur une piece produite a l'administration.
 */
function jamais(valeur: never, contexte: string): never {
  throw new Error(`${contexte} : valeur non couverte « ${String(valeur)} »`);
}

/** Minuscules, sans accent, espaces normalises et apostrophes unifiees : forme
    de comparaison unique pour la detection des formulations interdites et des
    mots bannis d'une branche. Sans elle, « Exoneration » passerait au travers du
    controle qui cherche « exoneration ». */
export const normaliserTexte = (t: string): string =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();

/** Formulations valant aveu detectees dans un champ libre. Fonction PURE : elle
    ne corrige rien, elle signale — l'outil n'ecrit pas a la place de
    l'utilisateur, il l'avertit de ce qu'il vient d'ecrire. */
export function detecterFormulationsInterdites(
  texte: string,
): ReadonlyArray<{ expression: string; motif: string }> {
  const n = normaliserTexte(texte);
  if (!n.trim()) return [];
  return FORMULATIONS_INTERDITES.filter((f) => n.includes(normaliserTexte(f.expression)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendrier
//
// Tout en UTC et en jours entiers. Une soustraction de dates LOCALES traverse
// les changements d'heure et produit 44,96 jours arrondis a 44 — soit une
// forclusion annoncee la veille du bon jour.
// ─────────────────────────────────────────────────────────────────────────────

const JOUR_MS = 86400000;

/** Borne haute de saisie des champs de date. Valeur de VRAISEMBLANCE, pas de
    droit : un « 9999-12-31 » tape dans un `input type="date"` est
    syntaxiquement valide et produirait une echeance au « 1er fevrier 10000 »
    affichee sans un mot. Declaree ici pour que l'attribut `max` des champs de
    l'interface et le controle de coherence d'`avertissements` lisent LA MEME
    borne. Le format ISO a quantiemes fixes s'ordonne lexicographiquement : la
    comparaison se fait en chaîne, apres validation par `jourUTC`. */
export const SAISIE_DATE_MAX = "2099-12-31";

/** ISO `AAAA-MM-JJ` -> timestamp UTC, ou null si la chaîne n'est pas une date.
    Le controle porte aussi sur la VALIDITE du quantieme : « 2026-02-31 » est
    syntaxiquement conforme et doit pourtant etre rejete. */
function jourUTC(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(a, mo - 1, j);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) return null;
  return t;
}

const isoDe = (t: number): string => new Date(t).toISOString().slice(0, 10);

/** Ajoute des jours entiers a une date ISO. Null si la date est illisible. */
export function ajouterJours(iso: string, jours: number): string | null {
  const t = jourUTC(iso);
  return t === null ? null : isoDe(t + jours * JOUR_MS);
}

/**
 * Ajoute des mois a une date ISO, quantieme conserve, RAMENE au dernier jour du
 * mois d'arrivée lorsque le quantieme n'y existe pas : un avis notifie le
 * 31 janvier ouvre un delai d'un mois qui expire le 28 (ou 29) fevrier, pas le
 * 3 mars. `Date.UTC(2026, 1, 31)` deborderait silencieusement sur mars — c'est
 * le genre de debordement qui fait declarer un recours hors delai.
 */
export function ajouterMois(iso: string, mois: number): string | null {
  const t = jourUTC(iso);
  if (t === null) return null;
  const d = new Date(t);
  const a = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const j = d.getUTCDate();
  const cible = new Date(Date.UTC(a, m + mois, 1));
  const dernierJourDuMois = new Date(
    Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return isoDe(
    Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth(), Math.min(j, dernierJourDuMois)),
  );
}

export type Echeance = {
  delai: Delai;
  /** Date limite incluse, ISO. */
  echeance: string;
  /** Phrase prete a afficher, fondement compris. */
  fondement: string;
};

/**
 * Date limite d'une demarche. Fonction PURE : `depart` est TOUJOURS une donnee
 * de saisie (la date d'envoi ou de notification portee sur l'avis), jamais
 * l'horloge de la machine.
 *
 * Renvoie null si la date de depart est illisible — l'interface affiche alors
 * « a completer », jamais une echeance calculee sur une date qu'on n'a pas
 * comprise.
 */
export function calculerEcheance(depart: string, id: DelaiId): Echeance | null {
  const delai = DELAIS[id];
  const echeance =
    delai.unite === "jours"
      ? ajouterJours(depart, delai.valeur)
      : delai.unite === "mois"
        ? ajouterMois(depart, delai.valeur)
        : delai.unite === "annees"
          ? ajouterMois(depart, delai.valeur * 12)
          : jamais(delai.unite, "Unité de délai");
  if (echeance === null) return null;
  // « mois » est invariable au pluriel, « annee » ne l'est pas : le seul accord a
  // faire porte sur les annees. Le ternaire d'origine testait `valeur > 1` pour
  // les mois et renvoyait « mois » dans les deux branches — bruit inutile qui
  // laissait croire a une regle d'accord qui n'existe pas.
  const unite =
    delai.unite === "annees" ? (delai.valeur > 1 ? "annees" : "annee") : delai.unite;
  return {
    delai,
    echeance,
    // « a compter de » etait concatene sans egard au texte qui suit. Le registre
    // porte des points de depart qui ne s'enchaînent pas derriere une
    // preposition (« meme point de depart que le paiement… », « notification de
    // l'avis de paiement… ») : la chaîne la plus lue de la page rendait
    // « 45 jours a compter de meme point de depart » et « 1 mois a compter de
    // notification ». On DECRIT le point de depart au lieu de le coller.
    fondement: `${delai.valeur} ${unite}, à compter du point de départ suivant : ${delai.pointDeDepart} (${delai.article})`,
  };
}

/** Vrai si la date du courrier depasse l'echeance. Null si l'un des deux
    elements est illisible : on ne conclut jamais « hors delai » sur une saisie
    incomplete, l'utilisateur renoncerait a un recours encore ouvert. */
export function estHorsDelai(depart: string, id: DelaiId, dateCourrier: string): boolean | null {
  const e = calculerEcheance(depart, id);
  const c = jourUTC(dateCourrier);
  if (e === null || c === null) return null;
  const limite = jourUTC(e.echeance);
  if (limite === null) return null;
  return c > limite;
}

// ─────────────────────────────────────────────────────────────────────────────
// Regles de fond
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Champ d'application de l'art. 529-10 CPP — DEUX conditions cumulatives, et
 * c'est la correction juridique la plus importante du sujet :
 *   1. l'avis a ete adresse au titulaire du certificat d'immatriculation (ou aux
 *      personnes visees aux trois derniers alineas de l'art. L. 121-2 :
 *      locataire, acquereur, representant legal) ; ET
 *   2. l'infraction figure dans la liste de l'art. L. 121-3, fixee par
 *      l'art. R. 121-6.
 *
 * Hors de ce champ, la requete en exoneration n'est soumise NI a la
 * consignation, NI a la lettre recommandee, NI au formulaire joint a peine
 * d'irrecevabilite. Le stationnement genant, tres genant, dangereux ou abusif et
 * la contravention de non-designation elle-meme sont hors champ ; l'arret, le
 * stationnement ou la circulation sur bande d'arret d'urgence y sont, eux,
 * soumis.
 *
 * Les deux termes sont des FAITS constates par l'utilisateur sur son avis, pas
 * une qualification que l'outil poserait a sa place.
 */
export function estDansLeChampDe529_10(e: {
  destinataireEstTitulaire: boolean;
  infractionListeL121_3: boolean;
}): boolean {
  return e.destinataireEstTitulaire && e.infractionListeL121_3;
}

/**
 * Texte qui transfere la responsabilite pecuniaire vers le locataire. Ternaire
 * EXHAUSTIF termine par `jamais()` : un `default` retomberait sur L121-2 pour une
 * nature d'infraction ajoutee a l'union, et imprimerait une fausse reference
 * d'article sur une piece produite a l'administration.
 */
export function texteResponsabiliteLocataire(
  n: NatureInfraction,
): { phrase: string; article: string; source: SourceRef } | null {
  return n === "stationnement-peage-dechets"
    ? {
        phrase:
          "Conformément à l'article L. 121-2, alinéa 2, du code de la route, la responsabilité pécuniaire pèse, dans ce cas, sur le locataire.",
        article: "art. L. 121-2, alinéa 2, du code de la route",
        source: SRC_L121_2,
      }
    : n === "controle-automatique"
      ? {
          phrase:
            "Conformément à l'article L. 121-3, alinéa 4, du code de la route, la responsabilité pécuniaire incombe, dans ce cas, au locataire.",
          article: "art. L. 121-3, alinéa 4, du code de la route",
          source: SRC_L121_3,
        }
      : n === "autre"
        ? null
        : jamais(n, "Nature d'infraction");
}

export type ResultatConsignation =
  | {
      calculable: true;
      montant: number;
      stade: "forfaitaire" | "majoree";
      article: string;
      source: SourceRef;
      /** Toujours imprimee : la consignation n'est pas un paiement. */
      verbatim: string;
    }
  | { calculable: false; motif: string };

/**
 * Montant de la consignation prealable du 2° de l'art. 529-10 : « un montant
 * egal a celui de l'amende forfaitaire ou a celui de l'amende forfaitaire
 * majoree ». Le montant est donc LU dans le bareme, jamais recopie — et lorsque
 * le bareme ne porte pas le stade demande pour la classe demandee (les montants
 * majores des trois premieres classes n'ont pas ete releves a la source), la
 * fonction renvoie `calculable: false` avec son motif. Elle ne devine pas.
 *
 * AUCUN MONTANT NET n'est calcule ici : l'imputation de la consignation sur
 * l'amende prononcee en cas de condamnation n'est prevue par aucun texte lu
 * (voir IMPUTATION_CONSIGNATION).
 */
export function montantConsignation(
  classe: ClasseContravention,
  stade: "forfaitaire" | "majoree",
): ResultatConsignation {
  const bareme = BAREME_CONTRAVENTIONS[classe];
  const ligne = stade === "forfaitaire" ? bareme.forfaitaire : bareme.majoree;
  if (!ligne) {
    return {
      calculable: false,
      motif: `Le montant de l'amende forfaitaire majorée d'une contravention de ${classe} classe n'a pas été releve à la source : la consignation ne peut pas être chiffree ici. Le montant à consigner est indique sur le formulaire joint à votre avis et par le parcours en ligne de l'ANTAI.`,
    };
  }
  return {
    calculable: true,
    montant: ligne.montant,
    stade,
    article: "art. 529-10, 2°, du code de procédure pénale",
    source: SRC_529_10,
    verbatim: VERBATIM_CONSIGNATION,
  };
}

/**
 * Plancher de l'amende prononcee en cas de condamnation — art. 530-1 CPP.
 * La majoration de 10 % est ENFERMEE dans le champ de l'art. 529-10 : hors de ce
 * champ, elle ne s'applique pas. Le plancher est BRUT : la consignation
 * eventuellement versee n'en est pas deduite, faute de texte le prevoyant.
 */
export function plancherCondamnation(
  classe: ClasseContravention,
  stade: "forfaitaire" | "majoree",
  champ529_10: boolean,
): { montant: number; article: string; source: SourceRef; note: string } | null {
  const bareme = BAREME_CONTRAVENTIONS[classe];
  const ligne = stade === "forfaitaire" ? bareme.forfaitaire : bareme.majoree;
  if (!ligne) return null;
  const montant = champ529_10 ? Math.round(ligne.montant * 1.1 * 100) / 100 : ligne.montant;
  return {
    montant,
    article: champ529_10
      ? "art. 530-1 du code de procédure pénale, majoration de 10 % propre aux cas de l'art. 529-10"
      : "art. 530-1 du code de procédure pénale",
    source: SRC_530_1,
    note: IMPUTATION_CONSIGNATION.detail,
  };
}

/**
 * Montant de la contravention de NON-DESIGNATION. Il est DERIVE du bareme de la
 * quatrieme classe et du quintuplement, jamais recopie : la note de cadrage
 * publie 450 / 675 / 1 875 euros, et ces trois valeurs sont en regression contre
 * la derivation (voir CAS_DE_CONTROLE, officiel: true).
 *
 * L'etiquette voyage avec le montant. Elle est la seule protection contre la
 * faute qui disqualifie toutes les pages du sujet : afficher 675 euros en face
 * d'un exces de vitesse.
 */
export function montantNonDesignation(stade: StadeAmende, personne: Personne): MontantEtiquete {
  const bareme = BAREME_CONTRAVENTIONS["4e"];
  const base =
    stade === "minoree"
      ? bareme.minoree
      : stade === "forfaitaire"
        ? bareme.forfaitaire
        : stade === "majoree"
          ? bareme.majoree
          : stade === "maximum-tribunal"
            ? bareme.maximumTribunal
            : jamais(stade, "Stade de l'amende");
  if (!base) {
    // Inatteignable avec le bareme actuel — la quatrieme classe porte les quatre
    // stades. On ne renvoie pas 0 pour autant : un zero imprime serait lu comme
    // « gratuit », alors qu'il signifierait « inconnu ».
    throw new Error(`Barème de non-designation : stade « ${stade} » absent de la 4e classe`);
  }
  const morale = personne === "morale";
  const facteur = morale ? QUINTUPLEMENT_PERSONNE_MORALE.facteur : 1;
  const articleQuintuple =
    stade === "maximum-tribunal"
      ? QUINTUPLEMENT_PERSONNE_MORALE.articleMaximum
      : QUINTUPLEMENT_PERSONNE_MORALE.articleForfaitaire;
  const sourceQuintuple =
    stade === "maximum-tribunal"
      ? QUINTUPLEMENT_PERSONNE_MORALE.sourceMaximum
      : QUINTUPLEMENT_PERSONNE_MORALE.sourceForfaitaire;
  return {
    montant: base.montant * facteur,
    etiquette: ETIQUETTE_NON_DESIGNATION,
    libelle: `Contravention de non-designation du conducteur (art. L. 121-6 du code de la route), ${
      morale ? "personne morale" : "personne physique"
    }`,
    article: morale ? `${base.article} et ${articleQuintuple}` : base.article,
    source: morale ? sourceQuintuple : base.source,
    statut: "verifie",
  };
}

/**
 * Majoration d'un forfait de post-stationnement impaye — art. R. 2333-120-16.
 * Le PLANCHER n'est pas un detail d'arrondi : sur un forfait de 17 euros, la
 * majoration reste de 50 euros, soit trois fois le forfait. La fonction dit donc
 * lequel des deux termes a joue, pour que l'interface puisse l'ecrire.
 * Renvoie null sur une entree non numerique : on n'affiche pas « NaN € » en face
 * d'une somme reclamee par une collectivite.
 */
export function calculerMajorationFps(restantDu: number): {
  restantDu: number;
  majoration: number;
  total: number;
  plancherApplique: boolean;
  article: string;
  source: SourceRef;
} | null {
  // Un forfait a 0 EUR n'est pas un forfait impaye : c'est un champ vide ou une
  // saisie erronee. Annoncer « 50 € a payer si le forfait reste impaye » a qui
  // ne doit rien serait faux, et le plancher de l'art. R. 2333-120-16 suppose
  // par construction un « montant impaye restant du ».
  if (!Number.isFinite(restantDu) || restantDu <= 0) return null;
  // COMPARAISON AVANT ARRONDI. L'arrondi au centime etait applique a la part
  // proportionnelle AVANT de la comparer au plancher : entre 249,99 EUR et
  // 250 EUR, 20 % valent 49,998 EUR, arrondis a 50,00 EUR, et la fonction
  // annoncait « part proportionnelle » alors que c'est le plancher qui joue. Le
  // montant restait juste, l'etiquette etait fausse — et cette etiquette est
  // publiee dans un tableau de la page.
  const proportionnelleExacte = restantDu * MAJORATION_FPS.taux;
  const proportionnelle = Math.round(proportionnelleExacte * 100) / 100;
  const majoration = Math.max(proportionnelle, MAJORATION_FPS.plancher);
  return {
    restantDu,
    majoration,
    total: Math.round((restantDu + majoration) * 100) / 100,
    plancherApplique: MAJORATION_FPS.plancher > proportionnelleExacte,
    article: MAJORATION_FPS.article,
    source: MAJORATION_FPS.source,
  };
}

/**
 * Exemple de comptage affiche dans la methodologie de la page. Il est CALCULE
 * par les vraies fonctions de calendrier, jamais recopie : c'est la seule facon
 * qu'un exemple pedagogique ne survive pas a la correction du delai qu'il
 * illustre. La meme date figure au premier cas de controle.
 */
export const EXEMPLE_COMPTAGE = (() => {
  const depart = "2026-03-01";
  const e = calculerEcheance(depart, "exoneration");
  return {
    depart,
    echeance: e ? e.echeance : null,
    phrase: e
      ? `Un avis envoyé le ${dateFr(depart)} ouvre un délai de ${DELAIS.exoneration.valeur} jours, qui expire le ${dateFr(e.echeance)}.`
      : "",
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// Notes editoriales de fond — consommees A LA FOIS par la prose de la page et
// par les avertissements affiches a cote du document.
// ─────────────────────────────────────────────────────────────────────────────

/** Designer n'est pas contester, et l'ordre compte. C'est le paragraphe que
    l'audience loueur vient chercher : contester sans avoir designe N'ETEINT PAS
    l'obligation de l'art. L. 121-6 et expose a une contravention distincte qui
    s'ajoute a l'amende initiale. */
export const NOTE_DESIGNER_NEST_PAS_CONTESTER = {
  texte:
    "Désigner et contester sont deux démarches distinctes. La désignation transfère l'avis au conducteur : l'amende et les points basculent sur lui. La contestation demande l'abandon de la poursuite. Pour un loueur, on désigne d'abord le locataire ; c'est ensuite à lui de contester s'il le souhaite. Contester sans avoir désigné n'éteint pas l'obligation de l'article L. 121-6 du code de la route et expose à une contravention de non-désignation, qui s'ajoute à l'amende initiale.",
  article: "art. L. 121-6 du code de la route ; art. 529-10, 1° b), du code de procédure pénale",
  source: SRC_L121_6,
  statut: "verifie" as Statut,
  note: "L'ANTAI ajoute, dans son périmètre exact : si le représentant légal est lui-même le conducteur du véhicule, il doit s'auto-désigner AVANT de contester ou de payer. Cette règle vise le cas où le représentant légal était au volant ; elle ne se généralisé pas.",
  sourceAntai: SRC_ANTAI_PARTICULIER,
};

/** Transfert legal de la redevabilite vers le locataire. Les deux phrases sont
    SEPAREES parce que les deux textes le sont, et la formulation « seulement si
    vous identifiez le locataire dans les delais » est interdite : cette condition
    n'existe dans aucun texte. */
export const NOTE_TRANSFERT_LOCATAIRE = {
  texte:
    "La loi désigne le locataire comme redevable pécuniaire de l'amende : l'article L. 121-2, alinéa 2, du code de la route pour le stationnement, les péages et les dépôts de déchets, l'article L. 121-3, alinéa 4, pour les infractions du contrôle automatique. Ce transfert ne dépend pas de votre contrat : il est légal. Il ne dispense pas pour autant le représentant légal de l'obligation distincte de désigner le conducteur dans les quarante-cinq jours (article L. 121-6). Ne pas désigner ne vous rend pas redevable de l'amende initiale à la place du locataire, mais vous expose à une contravention supplémentaire de non-désignation.",
  articles: [
    "art. L. 121-2, alinéa 2, du code de la route",
    "art. L. 121-3, alinéa 4, du code de la route",
    "art. L. 121-6 du code de la route",
  ],
  sources: [SRC_L121_2, SRC_L121_3, SRC_L121_6],
  statut: "verifie" as Statut,
};

/** Le cas du forfait de post-stationnement pour un loueur — la mauvaise
    nouvelle, ecrite franchement. La substitution du VII de L2333-87 est
    conditionnee a la MENTION du locataire sur le certificat d'immatriculation,
    ce qui n'arrive jamais en location courte duree. */
export const NOTE_FPS_LOUEUR = {
  texte:
    "Sur un forfait de post-stationnement, la substitution prévue au VII de l'article L. 2333-87 du code général des collectivités territoriales suppose que les mentions du certificat d'immatriculation permettent d'identifier un locataire. En location de courte durée, le locataire n'y figure jamais : le loueur reste destinataire de l'avis de paiement et redevable du forfait comme de sa majoration. Aucun texte n'ouvre ici de procédure de désignation équivalente à celle du régime pénal. Le recours administratif reste utile sur le fond — erreur de plaque, redevance déjà acquittée, véhicule cédé, plaque usurpée — mais il n'est pas un moyen de faire payer le client : le seul levier est contractuel.",
  article: "art. L. 2333-87, VII, du code général des collectivités territoriales",
  source: SRC_L2333_87,
  statut: "verifie" as Statut,
};

/** Le piege du siege — avec la bonne formulation. Le critere operant est
    l'adresse declaree au systeme d'immatriculation POUR CHAQUE VEHICULE, pas le
    siege social au sens du registre du commerce : aucun texte n'assimile les
    deux. */
export const NOTE_ADRESSE_CERTIFICAT = {
  texte:
    "L'avis d'amende forfaitaire majorée est envoyé en recommandé à l'adresse figurant sur le certificat d'immatriculation. Le critère opérant est donc l'adresse déclarée au système d'immatriculation pour chaque véhicule — souvent le siège, parfois l'établissement d'exploitation. Deux conséquences : un transfert de siège ou une fermeture d'agence non répercutés au système d'immatriculation ferment le recours sur tous les véhicules restés à l'ancienne adresse, simultanément ; et un accusé de réception signé par un salarié parti ou par un service courrier établit la connaissance de l'avis, ce qui referme la soupape de prescription du deuxième alinéa de l'article 530. D'où la nécessité de centraliser la réception des recommandés et de tenir un registre daté.",
  article: "art. 530, alinéa 2, du code de procédure pénale",
  source: SRC_530,
  statut: "verifie" as Statut,
  sourceComplementaire: SRC_F18510,
};

/** Le risque reel de contester — art. 530-1. Aucun delai de reponse n'est fixe
    par les textes : on le DIT, plutot que d'inventer un delai. Le droit fixe de
    procedure est mentionne SANS AUCUN MONTANT (voir POINTS_A_LEVER). */
export const NOTE_RISQUE_CONTESTER = {
  texte:
    "Le ministère public dispose de trois suites : renoncer à l'exercice des poursuites, engager la procédure devant le tribunal de police, ou aviser l'intéressé de l'irrecevabilité de la réclamation non motivée ou non accompagnée de l'avis. En cas de condamnation, l'amende prononcée ne peut être inférieure au montant de l'amende forfaitaire — et de l'amende forfaitaire majorée lorsque la contestation intervenait à ce stade. Aucun délai de réponse n'est fixé par les textes. Une condamnation peut en outre donner lieu au droit fixe de procédure de l'article 1018 A du code général des impôts.",
  article: "art. 530-1 du code de procédure pénale",
  source: SRC_530_1,
  statut: "verifie" as Statut,
  note: "Aucun montant de droit fixe de procédure n'est publié ici : le barème n'a pas été ouvert et les chiffres qui circulent correspondent à des lignes qui ne sont pas celles de l'ordonnance pénale contraventionnelle. Point ouvert « droit-fixe-procedure ».",
};

/** Les dix mentions qu'un courrier doit porter, quelle que soit la branche.
    Aucune n'est facultative dans un dossier reel ; elles sont exportees pour
    etre affichees comme liste de controle a cote du document. */
export const MENTIONS_OBLIGATOIRES: ReadonlyArray<{ id: string; texte: string }> = [
  { id: "identite", texte: "Identité complète de l'auteur et, le cas échéant, sa qualité (représentant légal, mandataire)." },
  { id: "adresse-reponse", texte: "Adresse à laquelle la réponse doit être adressée." },
  { id: "reference-avis", texte: "Référence exacte de l'avis : numéro d'avis, numéro de dossier, clé de télépaiement, recopiés tels quels." },
  { id: "immatriculation", texte: "Immatriculation du véhicule." },
  { id: "faits", texte: "Date, heure et lieu des faits, tels que portes sur l'avis." },
  { id: "fondement", texte: "Fondement légal invoque, nomme." },
  { id: "demande", texte: "Demande explicite : exonération, annulation du titre exécutoire, annulation du forfait de post-stationnement." },
  { id: "pieces", texte: "Liste numérotée des pièces jointes." },
  { id: "signature", texte: "Lieu, date et signature manuscrite — une lettre non signée n'est pas « une lettre signée de l'auteur de la requête » au sens du 1° b) de l'article 529-10." },
  { id: "mode-envoi", texte: "Mention du mode d'envoi, avec le numéro de suivi du recommandé à conserver." },
];

// ─────────────────────────────────────────────────────────────────────────────
// LES VOIES
//
// `Readonly<Record<Voie, DefinitionVoie>>` : ajouter un membre a `Voie` sans
// ecrire sa definition fait echouer la compilation. Une voie manquante ferait
// composer un courrier sans delai, sans destinataire et sans piece obligatoire.
//
// `piecesObligatoires` est une FONCTION et non une liste figee : dans le champ
// de l'art. 529-10, le formulaire joint a l'avis est exige a peine
// d'irrecevabilite ; hors de ce champ, il ne l'est pas. Une liste figee aurait
// impose une piece introuvable a des contestations de stationnement qui n'en ont
// pas besoin.
// ─────────────────────────────────────────────────────────────────────────────

export type DefinitionVoie = {
  id: Voie;
  intitule: string;
  /** Ce qui est IMPRIME sur le papier recu. C'est le SEUL critere de tri : ni le
      motif, ni le montant, ni « radar ou stationnement ». */
  intitulePapier: string;
  article: string;
  source: SourceRef;
  /** Delai principal. Non nul meme pour la voie routee : l'utilisateur doit
      connaître le delai qui court, meme quand l'outil ne redige pas. */
  delai: DelaiId;
  destinataire: string;
  aideDestinataire: string;
  formeEnvoi: string;
  motivation: string;
  effet: string;
  silence: string;
  /** Faux pour l'opposition a ordonnance penale : elle se forme par declaration
      selon les modalites notifiees par le greffe, pas par une lettre libre. */
  genereUnCourrier: boolean;
  sousBranches: readonly SousBranche[];
  objet: (s: Saisie) => string;
  formule: string;
  piecesObligatoires: (s: Saisie) => readonly string[];
  /** Chaînes dont la presence dans le document genere est une faute de REGIME,
      pas de style. La branche D en porte quatre : un recours contre une
      redevance administrative qui parle de ministere public, d'exoneration, de
      consignation ou de points melange deux ordres juridiques. */
  motsInterdits: readonly string[];
};

/** Justificatif de la consignation du 2° de l'art. 529-10. Constante unique :
    la meme piece est produite par la requete en exoneration ET par la
    reclamation, et deux libelles auraient diverge. */
const PIECE_CONSIGNATION =
  "Justificatif du versement de la consignation préalable prévue au 2° de l'article 529-10 du code de procédure pénale";

/**
 * Formulaire joint a l'avis. Le texte vise « le formulaire joint a l'avis
 * d'amende forfaitaire » sans le nommer ; le PAPIER, lui, le nomme — et il ne
 * porte pas le meme intitule aux deux stades. Envoyer un utilisateur chercher
 * un « formulaire de requete en exoneration » sur un avis d'amende forfaitaire
 * majoree, c'est le faire chercher une piece qui n'existe pas sous ce nom, alors
 * meme que le module fait de son absence une cause de rejet.
 */
const pieceFormulaireJoint = (voie: Voie): string =>
  voie === "reclamation"
    ? "Formulaire de réclamation joint à l'avis d'amende forfaitaire majorée, complété et signé (exigé à peine d'irrecevabilité dans le champ de l'article 529-10 du code de procédure pénale)"
    : "Formulaire de requête en exonération joint à l'avis, complété et signé (exigé à peine d'irrecevabilité dans le champ de l'article 529-10 du code de procédure pénale)";

/**
 * Pieces de recevabilite de l'art. 529-10, assemblees pour une voie donnee.
 *
 * Deux pieces, pas une. Le formulaire joint, d'abord, exige a peine
 * d'irrecevabilite dans le champ de l'article. Le justificatif de consignation,
 * ensuite, des lors que le courrier ne porte aucun document du 1° et que la
 * consignation a ete versee : c'est l'autre branche de l'alternative, et sans
 * elle la requete ou la reclamation est irrecevable de plein droit.
 */
const pieces529_10 = (s: Saisie, voie: Voie): readonly string[] => {
  if (!estDansLeChampDe529_10(s)) return [];
  const cons = consignationRequise(s);
  return cons.requise && s.consignationVersee
    ? [pieceFormulaireJoint(voie), PIECE_CONSIGNATION]
    : [pieceFormulaireJoint(voie)];
};

export const VOIES: Readonly<Record<Voie, DefinitionVoie>> = {
  exoneration: {
    id: "exoneration",
    intitule: "Requête en exonération",
    intitulePapier: "Avis de contravention",
    article: "art. 529-2 du code de procédure pénale",
    source: SRC_529_2,
    delai: "exoneration",
    destinataire: "Le service indiqué dans l'avis de contravention",
    aideDestinataire:
      "Recopiez le bloc « Officier du ministère public » figurant sur votre avis — en bas à droite de la page 1 pour un avis de contravention. Le texte de l'article 529-2 vise « le service indique dans l'avis » ; c'est l'article 529-10 qui confie à l'officier du ministère public la vérification de recevabilité. Aucune adresse nationale n'existe.",
    formeEnvoi:
      "Envoi en lettre recommandée avec demande d'avis de réception. La voie dématérialisée est prévue par le dernier alinéa de l'article 529-10 du code de procédure pénale et mise en œuvre par le parcours en ligne de l'ANTAI.",
    motivation:
      "Motivation de fait exigée : une requête non motivée expose à un avis d'irrecevabilité (art. 530-1).",
    effet: "Transmission au ministère public.",
    silence: "Aucun délai de réponse n'est fixe par les textes.",
    genereUnCourrier: true,
    sousBranches: ["a1-conducteur", "a2-evenement", "a3-realite"],
    objet: (s) =>
      `Requête en exonération — avis de contravention n° ${val(s.numeroAvis, 12)} — article 529-2 du code de procédure pénale`,
    formule:
      "Je vous prie d'agréer, Monsieur l'Officier du ministère public, l'expression de ma considération distinguée.",
    piecesObligatoires: (s) => pieces529_10(s, "exoneration"),
    motsInterdits: [],
  },
  designation: {
    id: "designation",
    intitule: "Désignation du conducteur par une personne morale",
    intitulePapier: "Avis d'infraction adressé à une société",
    article: "art. L. 121-6 du code de la route",
    source: SRC_L121_6,
    delai: "designation",
    destinataire: "L'autorité mentionnée sur l'avis d'infraction",
    aideDestinataire:
      "Recopiez le bloc d'adresse porté sur l'avis. La désignation est aussi réalisable en ligne, à l'unité sur le téléservice usagers de l'ANTAI, et en masse sur l'espace gestionnaire de flotte pour les flottes de plus de dix véhicules.",
    formeEnvoi:
      "Envoi en lettre recommandée avec demande d'avis de réception, ou de façon dématérialisée : l'article L. 121-6 du code de la route prévoit les deux modalités.",
    motivation:
      "La désignation n'a pas à être motivée : elle doit être COMPLÈTE. C'est l'incomplétude, et non l'absence de motif, qui la fait rejeter.",
    effet:
      "Un nouvel avis est émis au nom du conducteur désigne : l'amende et les points basculent sur lui.",
    silence: "Aucun délai de réponse n'est fixe par les textes.",
    genereUnCourrier: true,
    sousBranches: ["b1-locataire", "b2-salarie", "b3-impossible"],
    objet: (s) =>
      `Désignation du conducteur — avis d'infraction n° ${val(s.numeroAvis, 12)} — article L. 121-6 du code de la route`,
    formule: "Je vous prie d'agréer, Madame, Monsieur, l'expression de ma considération distinguée.",
    piecesObligatoires: (s) => pieces529_10(s, "designation"),
    // Une designation qui conteste la realite de l'infraction detruit les deux
    // demarches : le §6 du gabarit imprime au contraire une clause de
    // non-contestation, et ce garde-fou verifie qu'aucune reecriture ne l'a
    // remplacee par son contraire.
    motsInterdits: ["je conteste la réalité de l'infraction"],
  },
  reclamation: {
    id: "reclamation",
    intitule: "Réclamation contre une amende forfaitaire majorée",
    intitulePapier: "Avis d'amende forfaitaire majorée",
    article: "art. 530, alinéa 2, du code de procédure pénale",
    source: SRC_530,
    delai: "reclamation",
    destinataire: "Le ministère public",
    aideDestinataire:
      "En pratique, l'officier du ministère public dont l'adresse est imprimée sur l'avis — en haut à gauche sur un avis d'amende forfaitaire majorée. Recopiez ce bloc.",
    formeEnvoi:
      "Envoi en lettre recommandée avec demande d'avis de réception. La voie dématérialisée est prévue par le dernier alinéa de l'article 529-10 du code de procédure pénale lorsque cet article s'applique.",
    motivation:
      "Motivation exigée par le texte lui-même : le mot « motivée » figure dans l'alinéa 2 de l'article 530.",
    effet: "Annule le titre exécutoire en ce qui concerne l'amende contestée.",
    silence: "Aucun délai de réponse n'est fixe par les textes.",
    genereUnCourrier: true,
    sousBranches: [
      "c1-avis-initial-jamais-recu",
      "c2-jamais-connaissance",
      "c3-changement-adresse",
      "c4-designation-jointe",
      "c5-realite-majoree",
    ],
    objet: (s) =>
      `Réclamation — avis d'amende forfaitaire majorée n° ${val(s.numeroAvis, 12)} — article 530, alinéa 2, du code de procédure pénale`,
    formule:
      "Je vous prie d'agréer, Monsieur l'Officier du ministère public, l'expression de ma considération distinguée.",
    // L'avis d'amende forfaitaire majoree est exige A PEINE D'IRRECEVABILITE par
    // l'alinea 3 de l'art. 530. Il est en tete de liste et n'est jamais
    // supprimable : c'est la deuxieme cause de rejet du sujet.
    piecesObligatoires: (s) => [
      "L'avis d'amende forfaitaire majorée contesté (pièce exigée à peine d'irrecevabilité par l'article 530, alinéa 3, du code de procédure pénale)",
      ...pieces529_10(s, "reclamation"),
    ],
    motsInterdits: [],
  },
  rapo: {
    id: "rapo",
    intitule: "Recours administratif préalable obligatoire (forfait de post-stationnement)",
    intitulePapier: "Avis de paiement d'un forfait de post-stationnement",
    article: "art. R. 2333-120-13 du code général des collectivités territoriales",
    source: SRC_R2333_120_13,
    delai: "rapo",
    destinataire:
      "La commune, l'établissement public de coopération intercommunale, le syndicat mixte ou le tiers contractant dont relève l'agent assermenté ayant établi l'avis de paiement",
    aideDestinataire:
      "L'adresse figure sur l'avis de paiement. Ce n'est jamais l'ANTAI : un recours adressé à l'ANTAI ne suspend aucun délai.",
    formeEnvoi:
      "Envoi en lettre recommandée avec demande d'avis de réception, ou par le procédé électronique mis à disposition par la collectivité : l'article R. 2333-120-13 du code général des collectivités territoriales impose l'une ou l'autre forme à peine d'irrecevabilité.",
    motivation:
      "Un exposé des faits ET un exposé des moyens sont exigés à peine d'irrecevabilité.",
    effet:
      "Avis de paiement rectificatif (art. R. 2333-120-14) ou annulation de l'avis contesté.",
    silence:
      "Le silence gardé pendant un mois à compter de la réception du recours vaut décision de rejet.",
    genereUnCourrier: true,
    sousBranches: ["d1-recours"],
    objet: (s) =>
      `Recours administratif préalable obligatoire — avis de paiement du forfait de post-stationnement n° ${val(s.numeroAvis, 12)} — article R. 2333-120-13 du code général des collectivités territoriales`,
    formule: "Je vous prie d'agréer, Madame, Monsieur, l'expression de ma considération distinguée.",
    // En tete et non supprimables : le texte les exige a peine d'irrecevabilite.
    //
    // C10 : le texte ecrit « une copie de l'avis de paiement conteste, du
    // certificat d'immatriculation du vehicule concerne OU, LE CAS ECHEANT, DE
    // LA DECLARATION DE CESSION ». Imposer les deux pieces en dur reclamait un
    // certificat d'immatriculation a celui qui invoque precisement la cession du
    // vehicule — c'est-a-dire a celui qui ne le detient plus.
    piecesObligatoires: (s) => [
      "Copie de l'avis de paiement du forfait de post-stationnement contesté",
      s.moyensRapo.includes("vehicule-cede")
        ? "Copie de la déclaration de cession du véhicule (variante expressément prévue par l'article R. 2333-120-13 du code général des collectivités territoriales lorsque le véhicule a été cédé)"
        : "Copie du certificat d'immatriculation du véhicule",
    ],
    // Les quatre mots d'un autre ordre juridique. Le forfait de post-stationnement
    // est une redevance d'occupation du domaine public : il n'y a ni ministere
    // public, ni exoneration, ni consignation, ni retrait de points.
    // « point » seul declenchait sur « Sur ce point, l'horodateur etait en
    // panne », phrase parfaitement recevable, et affichait un BLOCAGE. Le mot
    // vise n'est pas « point » : ce sont les tournures du permis a points, qui
    // n'ont aucun sens dans un recours contre une redevance d'occupation du
    // domaine public. On cible donc les tournures, pas le mot.
    motsInterdits: [
      "ministère public",
      "exoneration",
      "consignation",
      "retrait de point",
      "perte de point",
      "permis à point",
      "points de mon permis",
      "points du permis",
      "solde de points",
    ],
  },
  "opposition-routee": {
    id: "opposition-routee",
    intitule: "Opposition à une ordonnance pénale — voie non générée",
    intitulePapier: "Avis de condamnation pécuniaire",
    article: "art. 527 du code de procédure pénale",
    source: SRC_527,
    delai: "opposition",
    destinataire: "Le greffe, selon les modalités notifiées avec l'ordonnance",
    aideDestinataire:
      "Les modalités de l'opposition sont indiquées sur la notification elle-même. Suivez-les : elles varient d'une juridiction à l'autre.",
    formeEnvoi:
      "Déclaration selon les modalités notifiées. Ce n'est pas une lettre libre.",
    motivation: "Sans objet : l'opposition n'a pas à être motivée pour être formée.",
    effet:
      "Le comptable public arrête le recouvrement dès réception de l'avis d'opposition établi par le greffe.",
    silence: "Sans objet.",
    genereUnCourrier: false,
    sousBranches: ["z-routage"],
    objet: () => "",
    formule: "",
    piecesObligatoires: () => [],
    motsInterdits: [],
  },
};

/**
 * Voie de chaque sous-branche. Declaree en `Record<SousBranche, Voie>` — donc
 * exhaustive a la compilation — ET recoupee avec `VOIES[v].sousBranches` par
 * `verifierContestation()` : les deux tables disent la meme chose de deux facons,
 * et une sous-branche ajoutee d'un seul cote fait echouer l'un des deux
 * controles.
 */
export const VOIE_DE_SOUS_BRANCHE: Readonly<Record<SousBranche, Voie>> = {
  "a1-conducteur": "exoneration",
  "a2-evenement": "exoneration",
  "a3-realite": "exoneration",
  "b1-locataire": "designation",
  "b2-salarie": "designation",
  "b3-impossible": "designation",
  "c1-avis-initial-jamais-recu": "reclamation",
  "c2-jamais-connaissance": "reclamation",
  "c3-changement-adresse": "reclamation",
  "c4-designation-jointe": "reclamation",
  "c5-realite-majoree": "reclamation",
  "d1-recours": "rapo",
  "z-routage": "opposition-routee",
};

/**
 * Combinaisons interdites. Le modele de saisie ne porte qu'UNE sous-branche : la
 * combinaison est donc deja impossible par construction, et cette table sert a
 * deux choses que le typage ne fait pas — expliquer POURQUOI a l'utilisateur qui
 * cherche a faire les deux, et fournir un cas de regression executable.
 */
export const SOUS_BRANCHES_EXCLUSIVES: ReadonlyArray<{
  a: SousBranche;
  b: SousBranche;
  motif: string;
}> = [
  {
    a: "a1-conducteur",
    b: "a3-realite",
    motif:
      "Désigner le conducteur (1° b de l'article 529-10) et contester la réalité de l'infraction (2° du même article) sont les deux termes d'une alternative. Un courrier qui fait les deux détruit les deux : il désigne un conducteur pour une infraction dont il soutient qu'elle n'a pas eu lieu.",
  },
  {
    a: "c4-designation-jointe",
    b: "c5-realite-majoree",
    motif:
      "Désigner le conducteur (1° b de l'article 529-10) et contester la réalité de l'infraction sont les deux termes d'une alternative, au stade majoré comme au stade forfaitaire. Un courrier qui fait les deux détruit les deux.",
  },
  {
    a: "b1-locataire",
    b: "a3-realite",
    motif:
      "Une désignation qui conteste la réalité de l'infraction n'est plus une désignation. Désignez d'abord ; le conducteur désigné contestera ensuite s'il le souhaite.",
  },
  {
    a: "b2-salarie",
    b: "a3-realite",
    motif:
      "Une désignation qui conteste la réalité de l'infraction n'est plus une désignation. Désignez d'abord ; le conducteur désigné contestera ensuite s'il le souhaite.",
  },
  {
    a: "c4-designation-jointe",
    b: "a3-realite",
    motif:
      "La réclamation qui emporte désignation vaut document du 1° b) de l'article 529-10 ; y ajouter la contestation de la réalité de l'infraction la ferait basculer dans le 2°, qui suppose une consignation.",
  },
];

/** Vrai si les deux sous-branches peuvent figurer dans le meme courrier. */
export function combinaisonAutorisee(
  a: SousBranche,
  b: SousBranche,
): { autorisee: boolean; motif: string | null } {
  if (a === b) return { autorisee: true, motif: null };
  const interdite = SOUS_BRANCHES_EXCLUSIVES.find(
    (x) => (x.a === a && x.b === b) || (x.a === b && x.b === a),
  );
  return interdite
    ? { autorisee: false, motif: interdite.motif }
    : { autorisee: true, motif: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Moyens invocables dans un recours contre un forfait de post-stationnement
//
// Ils sont exiges A PEINE D'IRRECEVABILITE par R. 2333-120-13 (« un expose des
// faits et moyens »). Chaque moyen porte SA phrase et SA piece : l'utilisateur
// coche, l'outil n'invente pas de moyen a sa place.
// ─────────────────────────────────────────────────────────────────────────────

export type MoyenRapo =
  | "redevance-acquittee"
  | "horodateur-hors-service"
  | "erreur-immatriculation"
  | "vehicule-cede"
  | "plaque-usurpee"
  | "vehicule-vole";

/**
 * QUALITE en laquelle le recours contre un forfait de post-stationnement est
 * forme. L'art. R. 2333-120-13 du CGCT ne connait pas que le titulaire du
 * certificat d'immatriculation : il ouvre le recours au titulaire, au
 * locataire, a l'acquereur, et a toute personne habilitee par mandat. Un loueur
 * dont le locataire longue duree figure au certificat, ou un mandataire, ne peut
 * pas signer une lettre qui affirme une qualite qu'il n'a pas.
 */
export type QualiteRapo = "titulaire" | "locataire" | "acquereur" | "mandataire";

export const QUALITES_RAPO: ReadonlyArray<{
  id: QualiteRapo;
  label: string;
  /** Fragment complet de la phrase d'ouverture. C'est une FONCTION et non une
      chaine : la place de l'immatriculation dans la phrase n'est pas la meme
      selon la qualite, et une chaine a trou aurait produit « mandataire pour le
      compte du redevable du vehicule AB-123-CD ». */
  phrase: (immatriculation: string) => string;
  /** Piece que la qualite impose en propre, ou null. */
  piece: string | null;
}> = [
  {
    id: "titulaire",
    label: "Titulaire du certificat d'immatriculation",
    phrase: (i) => `titulaire du certificat d'immatriculation du véhicule ${i}`,
    piece: null,
  },
  {
    id: "locataire",
    label: "Locataire du véhicule",
    phrase: (i) =>
      `locataire du véhicule ${i}, au sens de l'article R. 2333-120-13 du code général des collectivités territoriales`,
    piece: "Copie du contrat de location du véhicule",
  },
  {
    id: "acquereur",
    label: "Acquéreur du véhicule",
    phrase: (i) =>
      `acquéreur du véhicule ${i}, au sens de l'article R. 2333-120-13 du code général des collectivités territoriales`,
    piece: "Justificatif de l'acquisition du véhicule",
  },
  {
    id: "mandataire",
    label: "Mandataire habilité par le redevable",
    phrase: (i) =>
      `agissant, pour le véhicule ${i}, en vertu du mandat joint aux présentes et pour le compte du redevable`,
    piece: "Mandat écrit habilitant le signataire à former le recours",
  },
];

export const MOYENS_RAPO: ReadonlyArray<{
  id: MoyenRapo;
  label: string;
  phrase: string;
  piece: string;
}> = [
  {
    id: "redevance-acquittee",
    label: "La redevance de stationnement avait été acquittée",
    phrase:
      "La redevance de stationnement était acquittée pour la période et l'emplacement considérés, ainsi qu'en atteste le justificatif joint.",
    piece: "Justificatif d'acquittement de la redevance de stationnement",
  },
  {
    id: "horodateur-hors-service",
    label: "L'horodateur était hors service",
    phrase:
      "L'appareil permettant d'acquitter la redevance était hors service à la date et à l'heure des faits, ce qui a placé l'usager dans l'impossibilité matérielle de s'en acquitter.",
    piece: "Photographie datée de l'appareil hors service, ou attestation de la collectivité",
  },
  {
    id: "erreur-immatriculation",
    label: "Erreur sur l'immatriculation relevée",
    phrase:
      "L'immatriculation portée sur l'avis de paiement ne correspond pas à celle du véhicule visé, ainsi qu'il ressort du certificat d'immatriculation joint.",
    piece: "Copie du certificat d'immatriculation faisant apparaître la divergence",
  },
  {
    id: "vehicule-cede",
    label: "Le véhicule avait été cédé avant les faits",
    phrase:
      "Le véhicule avait été cédé antérieurement à la date des faits, ainsi qu'en attestent la déclaration de cession et son accusé d'enregistrement dans le système d'immatriculation des véhicules.",
    piece:
      "Déclaration de cession du véhicule et accusé d'enregistrement dans le système d'immatriculation des véhicules",
  },
  {
    id: "plaque-usurpee",
    label: "La plaque d'immatriculation a été usurpée",
    phrase:
      "La plaque d'immatriculation du véhicule a fait l'objet d'une usurpation, laquelle a donné lieu au dépôt de plainte dont le récépissé est joint.",
    piece:
      "Récépissé du dépôt de plainte pour le délit d'usurpation de plaque d'immatriculation prévu par l'article L. 317-4-1 du code de la route",
  },
  {
    id: "vehicule-vole",
    label: "Le véhicule avait été volé",
    phrase:
      "Le véhicule avait été volé à la date des faits, ainsi qu'en atteste le récépissé de dépôt de plainte joint.",
    piece: "Récépissé du dépôt de plainte pour vol du véhicule",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MODELE DE SAISIE
//
// Tout est `string` sauf ce qui est un FAIT BINAIRE constate par l'utilisateur
// sur son papier. C'est deliberé : un champ numerique force un parsing, et un
// parsing rate imprime « NaN » sur une piece adressee a l'administration. Les
// montants restent des chaînes ; seul le moteur qui en a besoin les convertit,
// et il renvoie null quand il n'y arrive pas.
//
// Aucun champ « date de reception » : il n'a aucun effet juridique et sa seule
// presence dans un formulaire fait compter le delai a partir de la mauvaise
// date. La date pivot s'appelle `datePivot` et son libelle change avec la voie
// (envoi pour le penal, notification pour le forfait de post-stationnement).
// ─────────────────────────────────────────────────────────────────────────────

export type Saisie = {
  voie: Voie;
  sousBranche: SousBranche;
  personne: Personne;

  // Expediteur
  identite: string;
  denominationSociale: string;
  siren: string;
  nomSignataire: string;
  qualiteSignataire: string;
  adresse: string;
  codePostal: string;
  ville: string;
  email: string;
  telephone: string;

  /** Bloc d'adresse RECOPIE de l'avis. Jamais pre-rempli : il n'existe aucune
      adresse nationale de contestation, et envoyer au mauvais destinataire ne
      suspend aucun delai. Multi-lignes. */
  destinataireBloc: string;

  // L'avis
  numeroAvis: string;
  numeroDossier: string;
  immatriculation: string;
  dateFaits: string;
  heureFaits: string;
  lieuFaits: string;
  /** Date d'envoi portee sur l'avis — ou date de notification pour un forfait de
      post-stationnement. */
  datePivot: string;

  natureInfraction: NatureInfraction;
  classe: ClasseContravention;

  /** Les deux FAITS qui decident du champ de l'art. 529-10. L'utilisateur les
      lit sur son avis ; l'outil ne les qualifie pas a sa place. */
  destinataireEstTitulaire: boolean;
  infractionListeL121_3: boolean;

  /** TROISIEME fait lu sur l'avis, et le plus lourd de consequences : l'avis
      porte-t-il la mention « amende forfaitaire DELICTUELLE » ?
      Toutes les voies de cet outil relevent de la procedure CONTRAVENTIONNELLE
      (art. 529-2 pour la requete en exoneration, art. 530 pour la reclamation).
      L'amende forfaitaire delictuelle a sa procedure propre — requete en
      exoneration de l'art. 495-18, reclamation de l'art. 495-19, recevabilite de
      l'art. 495-20 — et un courrier forme sur les articles 529-2 ou 530 contre
      un avis delictuel est IRRECEVABLE. Le cas est devenu courant depuis que le
      tres grand exces de vitesse est un delit — le 29 decembre 2025, loi
      n° 2025-622 du 9 juillet 2025, cf. la note de la branche 5e classe de
      l'art. L. 121-6 plus haut dans ce fichier. L'outil ne
      peut pas le deviner : il pose la question et bloque, il ne route pas vers
      une voie qu'il ne sait pas produire. */
  avisEstDelictuel: boolean;

  // Champs libres
  exposeFaits: string;
  motivation: string;

  // Conducteur designe
  conducteurNom: string;
  conducteurNaissance: string;
  conducteurAdresse: string;
  conducteurPermis: string;

  // Location
  numeroContrat: string;
  debutLocation: string;
  finLocation: string;
  lienAvecSociete: string;

  // Evenement (A2 / B3). Vide tant que l'utilisateur n'a rien choisi : un
  // specimen imprimable ne doit pas affirmer un vol que personne n'a declare.
  evenement: Evenement | "";
  dateEvenement: string;

  // Reclamation (C)
  dateConnaissance: string;
  circonstanceConnaissance: string;
  dateDeclarationSiv: string;
  afmEnvoyeeLrarAdresseCertificat: boolean;
  contraventionCodeDeLaRoute: boolean;

  // Forfait de post-stationnement (D)
  montantFps: string;
  vehiculeLoue: boolean;
  moyensRapo: readonly MoyenRapo[];
  qualiteRapo: QualiteRapo;

  // Consignation
  consignationVersee: boolean;

  // Signature
  lieu: string;
  dateCourrier: string;
};

/**
 * Saisie vide. Aucune valeur par defaut n'est une QUALIFICATION : `evenement`
 * part vide plutot que sur le premier membre de son union, faute de quoi le
 * specimen imprimerait « le vehicule a fait l'objet d'un vol » a quelqu'un dont
 * la plaque a ete usurpee.
 * `destinataireEstTitulaire` et `infractionListeL121_3` partent a false : le
 * regime le plus exigeant (529-10) ne s'active que si l'utilisateur declare les
 * deux faits qui le declenchent, jamais par defaut.
 *
 * Aucune date n'est pre-remplie a la date du jour : ce module ne lit pas
 * l'horloge, faute de quoi il ne serait pas rejouable.
 */
export function saisieVide(sousBranche: SousBranche = "a1-conducteur"): Saisie {
  return {
    voie: VOIE_DE_SOUS_BRANCHE[sousBranche],
    sousBranche,
    personne: sousBranche.startsWith("b") || sousBranche === "c4-designation-jointe"
      ? "morale"
      : "physique",
    identite: "",
    denominationSociale: "",
    siren: "",
    nomSignataire: "",
    qualiteSignataire: "",
    adresse: "",
    codePostal: "",
    ville: "",
    email: "",
    telephone: "",
    destinataireBloc: "",
    numeroAvis: "",
    numeroDossier: "",
    immatriculation: "",
    dateFaits: "",
    heureFaits: "",
    lieuFaits: "",
    datePivot: "",
    natureInfraction: "controle-automatique",
    classe: "4e",
    destinataireEstTitulaire: false,
    infractionListeL121_3: false,
    avisEstDelictuel: false,
    exposeFaits: "",
    motivation: "",
    conducteurNom: "",
    conducteurNaissance: "",
    conducteurAdresse: "",
    conducteurPermis: "",
    numeroContrat: "",
    debutLocation: "",
    finLocation: "",
    lienAvecSociete: "",
    evenement: "",
    dateEvenement: "",
    dateConnaissance: "",
    circonstanceConnaissance: "",
    dateDeclarationSiv: "",
    afmEnvoyeeLrarAdresseCertificat: false,
    contraventionCodeDeLaRoute: true,
    montantFps: "",
    vehiculeLoue: false,
    moyensRapo: [],
    qualiteRapo: "titulaire",
    consignationVersee: false,
    lieu: "",
    dateCourrier: "",
  };
}

/**
 * La saisie a-t-elle REELLEMENT commence ?
 *
 * Fonction pure, declaree ici et non dans l'interface : c'est elle qui decide si
 * le Ctrl+P d'un visiteur imprime la page (et ses onze modeles) ou son courrier.
 * Un `Courrier` existe des le premier rendu — il est alors fait de pointilles —,
 * si bien que sa seule presence ne dit rien de l'intention de l'utilisateur.
 *
 * Les champs retenus sont ceux qu'on ne remplit pas par accident : une
 * reference d'avis, une identite, une date pivot, une immatriculation, un texte
 * libre. Les cases a cocher et les listes en sont exclues : elles portent une
 * valeur des le depart.
 */
export function saisieCommencee(s: Saisie): boolean {
  return [
    s.numeroAvis,
    s.identite,
    s.denominationSociale,
    s.datePivot,
    s.immatriculation,
    s.exposeFaits,
    s.motivation,
  ].some((x) => x.trim() !== "");
}

/** Recale la voie sur la sous-branche : les deux champs ne peuvent pas diverger,
    sous peine d'imprimer l'objet d'une requete en exoneration en tete d'un
    recours contre un forfait de post-stationnement. */
export function normaliserSaisie(s: Saisie): Saisie {
  const voie = VOIE_DE_SOUS_BRANCHE[s.sousBranche];
  return voie === s.voie ? s : { ...s, voie };
}

/** Montant saisi -> nombre, ou null. Accepte la virgule decimale et les espaces
    de milliers, y compris l'espace insecable que produit un copier-coller. */
export function montantSaisi(x: string): number | null {
  const n = Number(x.replace(/[\s  ]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GABARITS
//
// Un gabarit = un intitule, une aide de choix, et un corps INTERPOLE
// `(s: Saisie) => string[]`. Aucune chaîne a substitution maison : la variable
// interpolee est verifiee a la compilation, alors qu'un `{{NUMERO_AVIS}}` reste
// dans le document le jour ou le champ est renomme — et une variable non
// substituee sur une piece adressee a l'administration est une irrecevabilite.
// ─────────────────────────────────────────────────────────────────────────────

export type Gabarit = {
  id: SousBranche;
  voie: Voie;
  libelle: string;
  /** Question de FAIT posee a l'utilisateur. Jamais une qualification juridique
      que l'outil poserait a sa place (art. 54 de la loi n° 71-1130). */
  aide: string;
  paragraphes: (s: Saisie) => string[];
  pieces: (s: Saisie) => string[];
};

/** Bloc d'identification du dossier, commun a toutes les branches penales. */
const paragrapheIdentification = (s: Saisie, intitule: string): string =>
  `${intitule}, portant le n° ${val(s.numeroAvis, 12)}, vise le véhicule immatriculé ${val(
    s.immatriculation,
    9,
  )} pour des faits constatés le ${dateFr(s.dateFaits)} à ${heureFr(s.heureFaits)}, à ${val(
    s.lieuFaits,
    24,
  )}.`;

/** Le bloc de designation — le cœur des branches B et C4. Il collecte TOUJOURS
    les trois elements : l'art. L. 121-6 exige l'identite et l'adresse, le 1° b)
    de l'art. 529-10 exige en plus la reference du permis, et l'ANTAI demande les
    trois. Une seule saisie couvre ainsi les deux regimes. */
const blocDesignation = (s: Saisie): string[] => [
  `— Identité : ${val(s.conducteurNom, 24)}`,
  `— Date de naissance : ${dateFr(s.conducteurNaissance)}`,
  `— Adresse : ${val(s.conducteurAdresse, 30)}`,
  `— Référence du permis de conduire : ${val(s.conducteurPermis, 14)}`,
];

/** Phrase de double portee : la lettre signee qui designe vaut, dans le champ de
    l'art. 529-10, le document de son 1° b) — et dispense donc de consigner. */
const phraseDoublePortee =
  "La présente lettre, signée, précise l'identité, l'adresse et la référence du permis de conduire de la personne présumée conduire le véhicule ; elle constitue, à ce titre, le document prévu au 1° b) de l'article 529-10 du code de procédure pénale.";

const exposeOuPointilles = (t: string): string =>
  t.trim() || ".".repeat(60);

/**
 * Ouverture « Je soussigne… » des gabarits qui designent (B1, B2, B3, C4).
 *
 * LE TERNAIRE EST OBLIGATOIRE, comme dans la branche D (d1-recours) : le
 * selecteur « Auteur du courrier » reste actif sur ces branches, et l'interface
 * MASQUE Denomination sociale, SIREN, Nom et Qualite du signataire des que la
 * personne est physique. Les quatre gabarits imprimaient pourtant ces champs
 * inconditionnellement : un entrepreneur individuel obtenait soit quatre blancs
 * qu'aucun champ visible ne pouvait combler, soit — apres une bascule
 * morale → physique avec valeurs residuelles — un courrier dont l'en-tete et la
 * signature portaient une identite et la phrase operante une autre.
 */
const soussigne = (s: Saisie): string =>
  s.personne === "morale"
    ? `Je soussigné ${val(s.nomSignataire, 22)}, agissant en qualité de ${val(
        s.qualiteSignataire,
        18,
      )} et représentant légal de ${val(s.denominationSociale, 24)}, SIREN ${val(s.siren, 9)}`
    : `Je soussigné ${val(s.identite, 24)}`;

/** Meme ouverture, adresse comprise — premiere phrase des branches B. Le siege
    est celui d'une personne morale ; une personne physique « demeure ». */
const soussigneAvecAdresse = (s: Saisie): string =>
  `${soussigne(s)}, ${
    s.personne === "morale" ? "dont le siège est situé" : "demeurant"
  } ${val(s.adresse, 30)}, ${val(s.codePostal, 5)} ${val(s.ville, 16)},`;

// ─────────────────────────────────────────────────────────────────────────────
// RECEVABILITE DANS LE CHAMP DE L'ARTICLE 529-10
//
// L'art. 529-10 CPP ouvre une ALTERNATIVE, et une seule : ou bien la requete ou
// la reclamation est accompagnee de l'un des documents de son 1°, ou bien elle
// est accompagnee de la consignation de son 2°. A defaut des deux, elle est
// irrecevable — et l'art. 530, alinea 3, le redit expressement pour la
// RECLAMATION, en visant « le cas prevu par les articles 529-10 et 529-12 ».
//
// La regle ne depend donc ni de la voie ni de la sous-branche : elle depend de
// ce que le courrier PRODUIT. Elle est ecrite ici, une fois, sous forme de deux
// fonctions pures, et non repartie entre un garde de sous-branche dans les
// avertissements et une table de blocs dans l'interface — c'est ce partage qui
// laissait les quatre sous-branches de reclamation sans consignation, sans
// champ et sans avertissement, alors que le module savait deja chiffrer les
// 375 EUR d'une amende majoree de 4e classe et le publiait en cas de controle.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Document du 1° de l'art. 529-10 que la sous-branche produit REELLEMENT, ou
 * null. Un `null` n'est pas un defaut : c'est le fait qui declenche l'exigence
 * de consignation.
 */
export function documentDu1(s: Saisie): { lettre: "a" | "b" | "c" | "d"; libelle: string } | null {
  const b = (): { lettre: "b"; libelle: string } => ({
    lettre: "b",
    libelle:
      "lettre signée précisant l'identité, l'adresse et la référence du permis de conduire de la personne présumée conduire le véhicule",
  });
  switch (s.sousBranche) {
    case "a1-conducteur":
    case "b1-locataire":
    case "b2-salarie":
    case "c4-designation-jointe":
      return b();
    case "a2-evenement":
    case "b3-impossible": {
      const e = evenementDe(s.evenement);
      return e && e.lettre529_10 ? { lettre: e.lettre529_10, libelle: e.piece } : null;
    }
    case "a3-realite":
    case "c5-realite-majoree":
    case "c1-avis-initial-jamais-recu":
    case "c2-jamais-connaissance":
    case "c3-changement-adresse":
    case "d1-recours":
    case "z-routage":
      return null;
    default:
      return jamais(s.sousBranche, "Sous-branche");
  }
}

/** Stade auquel la consignation se chiffre : c'est le montant de l'amende
    ACTUELLEMENT due. Au stade majore, c'est l'amende forfaitaire majoree — 375
    EUR en 4e classe et non 135 EUR. */
export function stadeConsignation(s: Saisie): "forfaitaire" | "majoree" {
  return s.voie === "reclamation" ? "majoree" : "forfaitaire";
}

/**
 * Consignation exigee ? Fonction PURE, adossee a l'alternative du texte.
 * `requise` vaut vrai quand l'affaire est dans le champ de l'art. 529-10 ET que
 * le courrier ne porte aucun document de son 1°.
 */
export function consignationRequise(s: Saisie): {
  requise: boolean;
  stade: "forfaitaire" | "majoree";
  resultat: ResultatConsignation;
  document: ReturnType<typeof documentDu1>;
} {
  const stade = stadeConsignation(s);
  const document = documentDu1(s);
  return {
    requise: estDansLeChampDe529_10(s) && document === null,
    stade,
    resultat: montantConsignation(s.classe, stade),
    document,
  };
}

/**
 * Clause de delai a inserer dans le courrier, ou chaine VIDE.
 *
 * POURQUOI elle peut etre vide. Les gabarits affirmaient sans condition « dans
 * le delai de quarante-cinq jours prevu par l'article 529-1 » alors que le
 * moteur savait, et affichait a cote, que le courrier etait poste quatre mois
 * apres l'avis. L'outil faisait donc signer a l'utilisateur une affirmation
 * verifiable et fausse, adressee a l'autorite qui detient la date d'envoi —
 * l'inverse exact de la doctrine du module (« l'outil avertit, il ne corrige
 * pas », et surtout il n'affirme pas a la place de l'utilisateur).
 *
 * Sur une saisie incomplete, `estHorsDelai` rend `null` et la clause est
 * MAINTENUE : on ne prive pas d'un moyen recevable celui dont on ignore la date.
 * Seule la certitude du depassement fait taire l'affirmation.
 */
export function clauseDelai(s: Saisie, texte: string): string {
  const hors = estHorsDelai(s.datePivot, VOIES[s.voie].delai, s.dateCourrier);
  return hors === true ? "" : texte;
}

/**
 * Paragraphe de consignation d'une RECLAMATION, ou null.
 *
 * B1 corrige ici. Les quatre sous-branches de reclamation n'affichaient ni
 * champ, ni montant, ni avertissement de consignation : un utilisateur dans le
 * champ de l'art. 529-10 pouvait produire une reclamation ne portant ni
 * document du 1°, ni consignation du 2°, donc IRRECEVABLE par texte expres
 * (art. 530, alinea 3, qui vise « le cas prevu par les articles 529-10 et
 * 529-12 » et conclut « a defaut de quoi elle est irrecevable »). Le delai de
 * reclamation etant de trente jours, l'irrecevabilite se decouvre bien apres
 * son expiration : le titre executoire subsiste et l'interesse paie l'amende
 * majoree au lieu de l'amende forfaitaire.
 */
const paragrapheConsignationReclamation = (s: Saisie): string | null => {
  const cons = consignationRequise(s);
  if (!cons.requise) return null;
  const c = cons.resultat;
  if (s.consignationVersee) {
    return c.calculable
      ? `Conformément au 2° de l'article 529-10 du code de procédure pénale, auquel renvoie le troisième alinéa de l'article 530 du même code, j'ai acquitté une consignation préalable d'un montant de ${eur(
          c.montant,
        )}, égal à celui de l'amende forfaitaire majorée. Pour reprendre les termes du texte, ${VERBATIM_CONSIGNATION}.`
      : `Conformément au 2° de l'article 529-10 du code de procédure pénale, auquel renvoie le troisième alinéa de l'article 530 du même code, j'ai acquitté une consignation préalable d'un montant égal à celui de l'amende forfaitaire majorée. Pour reprendre les termes du texte, ${VERBATIM_CONSIGNATION}.`;
  }
  return `La présente réclamation entre dans le champ de l'article 529-10 du code de procédure pénale. Le troisième alinéa de l'article 530 du même code la subordonne, à peine d'irrecevabilité, à la production de l'un des documents énumérés au 1° de l'article 529-10 ou au versement de la consignation préalable prévue à son 2°${
    c.calculable ? `, d'un montant de ${eur(c.montant)}` : ""
  }.`;
};

export const GABARITS: Readonly<Record<SousBranche, Gabarit>> = {
  // ─── Branche A : requete en exoneration ───
  "a1-conducteur": {
    id: "a1-conducteur",
    voie: "exoneration",
    libelle: "Je n'étais pas le conducteur (véhicule prêté ou loué)",
    aide: "Vous avez reçu un avis de contravention et une autre personne conduisait le véhicule au moment des faits. Vous pouvez indiquer son identité, son adresse et la référence de son permis.",
    paragraphes: (s) => [
      `Par la présente, je forme une requête tendant à l'exonération de l'amende forfaitaire, en application de l'article 529-2 du code de procédure pénale${clauseDelai(
        s,
        ", dans le délai de quarante-cinq jours prévu par l'article 529-1 du même code",
      )}.`,
      paragrapheIdentification(s, "L'avis de contravention référencé ci-dessus"),
      exposeOuPointilles(s.exposeFaits),
      // MEME GARDE que la phraseDoublePortee de B1/B2 : hors du champ de
      // l'art. 529-10, un courrier qui cite cet article s'appuie sur un texte
      // qui ne s'applique pas a l'affaire — et affaiblit le recours qu'il porte.
      estDansLeChampDe529_10(s)
        ? "À la date et à l'heure des faits, je n'étais pas le conducteur de ce véhicule. Conformément au 1° b) de l'article 529-10 du code de procédure pénale, la présente lettre signée précise l'identité, l'adresse ainsi que la référence du permis de conduire de la personne qui était présumée conduire le véhicule :"
        : "À la date et à l'heure des faits, je n'étais pas le conducteur de ce véhicule. La personne qui était présumée conduire le véhicule est désignée ci-après, avec son identité, son adresse et la référence de son permis de conduire :",
      ...blocDesignation(s),
      "En conséquence, je vous demande de bien vouloir prononcer mon exonération et de classer sans suite la procédure à mon égard.",
    ],
    pieces: () => [],
  },
  "a2-evenement": {
    id: "a2-evenement",
    voie: "exoneration",
    libelle: "Vol, destruction, usurpation de plaque, cession ou conduite déléguée",
    aide: "Un événement documenté vous permet de produire l'une des pièces énumérées au 1° de l'article 529-10 du code de procédure pénale. Cette pièce dispense de toute consignation.",
    paragraphes: (s) => {
      const e = evenementDe(s.evenement);
      const lettre = e && e.lettre529_10;
      return [
        `Par la présente, je forme une requête tendant à l'exonération de l'amende forfaitaire, en application de l'article 529-2 du code de procédure pénale${clauseDelai(
          s,
          ", dans le délai de quarante-cinq jours prévu par l'article 529-1 du même code",
        )}.`,
        paragrapheIdentification(s, "L'avis de contravention référencé ci-dessus"),
        `Le véhicule ${val(s.immatriculation, 9)} a fait l'objet ${
          e ? e.tournure : ".".repeat(20)
        } le ${dateFr(s.dateEvenement)}.`,
        exposeOuPointilles(s.exposeFaits),
        // MEME GARDE que la phraseDoublePortee de B1/B2 : hors du champ de
        // l'art. 529-10, la piece est jointe sans citer un article qui ne
        // s'applique pas a l'affaire.
        !estDansLeChampDe529_10(s)
          ? "Je joins à la présente les pièces établissant cet événement, énumérées ci-dessous."
          : lettre
            ? `Je joins à la présente le document prévu au 1° ${lettre}) de l'article 529-10 du code de procédure pénale.`
            : "Je joins à la présente les pièces établissant cet événement. Il ne figure pas parmi les quatre documents énumérés au 1° de l'article 529-10 du code de procédure pénale : dans le champ de cet article, il ne dispense donc pas de la consignation prévue au 2°.",
        "En conséquence, je vous demande de bien vouloir prononcer mon exonération et de classer sans suite la procédure.",
      ];
    },
    pieces: (s) => {
      const e = evenementDe(s.evenement);
      return e ? [e.piece] : [];
    },
  },
  "a3-realite": {
    id: "a3-realite",
    voie: "exoneration",
    libelle: "Je conteste la réalité de l'infraction",
    aide: "Vous soutenez que l'infraction n'a pas été commise, ou qu'elle l'a été dans des conditions que l'avis ne reflète pas. Dans le champ de l'article 529-10, cette branche suppose une consignation, sauf à produire l'une des pièces de son 1°.",
    paragraphes: (s) => {
      const cons = consignationRequise(s);
      const c = cons.resultat;
      const l: string[] = [
        `Par la présente, je forme une requête tendant à l'exonération de l'amende forfaitaire, en application de l'article 529-2 du code de procédure pénale${clauseDelai(
          s,
          ", dans le délai de quarante-cinq jours prévu par l'article 529-1 du même code",
        )}.`,
        paragrapheIdentification(s, "L'avis de contravention référencé ci-dessus"),
        exposeOuPointilles(s.exposeFaits),
        "Je conteste la réalité de l'infraction pour les motifs exposés ci-dessus.",
      ];
      // LE COURRIER N'AFFIRME QUE CE QUI EST VRAI.
      //
      // La version precedente poussait, dans les DEUX cas, une phrase affirmant
      // qu'une consignation « accompagne la presente requete » — y compris
      // lorsque l'utilisateur venait de declarer ne pas l'avoir versee, et sans
      // meme imprimer le montant a payer. Le document se contredisait a trois
      // lignes d'intervalle, puisque sa liste de pieces jointes ne portait alors
      // aucun justificatif, et il adressait une declaration inexacte a
      // l'officier du ministere public, sur une piece signee.
      //
      // Hors du champ de l'art. 529-10, rien n'est exige et on le dit.
      if (cons.requise) {
        l.push(
          s.consignationVersee && c.calculable
            ? `Conformément au 2° de l'article 529-10 du code de procédure pénale, j'ai acquitté une consignation préalable d'un montant de ${eur(
                c.montant,
              )}, au moyen de la carte de consignation jointe au formulaire de requête en exonération. Pour reprendre les termes du texte, ${VERBATIM_CONSIGNATION}.`
            : s.consignationVersee
              ? `Conformément au 2° de l'article 529-10 du code de procédure pénale, j'ai acquitté la consignation préalable d'un montant égal à celui de l'amende forfaitaire, au moyen de la carte de consignation jointe au formulaire de requête en exonération. Pour reprendre les termes du texte, ${VERBATIM_CONSIGNATION}.`
              : `La présente requête entre dans le champ de l'article 529-10 du code de procédure pénale. Elle suppose donc, à défaut de l'un des documents énumérés à son 1°, le versement de la consignation préalable prévue à son 2°${
                  c.calculable ? `, d'un montant de ${eur(c.montant)}` : ""
                }. Pour reprendre les termes du texte, ${VERBATIM_CONSIGNATION}.`,
        );
      } else {
        l.push(
          "Aucune consignation n'est exigée : l'article 529-10 du code de procédure pénale ne s'applique pas à cette contravention.",
        );
      }
      l.push(
        "En conséquence, je vous demande de bien vouloir prononcer mon exonération et de classer sans suite la procédure.",
      );
      return l;
    },
    pieces: (s) =>
      consignationRequise(s).requise && s.consignationVersee
        ? [PIECE_CONSIGNATION]
        : [],
  },

  // ─── Branche B : designation par une personne morale ───
  "b1-locataire": {
    id: "b1-locataire",
    voie: "designation",
    libelle: "Le véhicule était loué à un tiers",
    aide: "Vous êtes une société et le véhicule était sous contrat de location au moment des faits. C'est la branche du loueur professionnel.",
    paragraphes: (s) => {
      const transfert = texteResponsabiliteLocataire(s.natureInfraction);
      const l = [
        soussigneAvecAdresse(s),
        `titulaire du certificat d'immatriculation du véhicule ${val(
          s.immatriculation,
          9,
        )}, destinataire de l'avis d'infraction référencé ci-dessus pour des faits constatés le ${dateFr(
          s.dateFaits,
        )} à ${heureFr(s.heureFaits)} à ${val(s.lieuFaits, 24)},`,
        `procède, en application de l'article L. 121-6 du code de la route${clauseDelai(
          s,
          " et dans le délai de quarante-cinq jours à compter de l'envoi ou de la remise de l'avis d'infraction",
        )}, à la désignation de la personne physique qui conduisait ce véhicule au moment des faits :`,
        ...blocDesignation(s),
        `Le véhicule était, à la date et à l'heure des faits, loué à la personne désignée ci-dessus au titre du contrat de location n° ${val(
          s.numeroContrat,
          12,
        )}, conclu du ${dateFr(s.debutLocation)} au ${dateFr(s.finLocation)}.`,
      ];
      if (transfert) l.push(transfert.phrase);
      l.push("La présente désignation ne constitue pas une contestation de la réalité de l'infraction.");
      if (estDansLeChampDe529_10(s)) l.push(phraseDoublePortee);
      return l;
    },
    pieces: (s) => {
      const p = ["Copie du contrat de location visé ci-dessus"];
      // La ligne n'apparaît que si la reference du permis est saisie : une liste
      // numerotee de pieces jointes n'imprime pas de « si elle est detenue » —
      // une piece y figure ou n'y figure pas.
      if (s.conducteurPermis.trim()) p.push("Copie du permis de conduire du locataire");
      return p;
    },
  },
  "b2-salarie": {
    id: "b2-salarie",
    voie: "designation",
    libelle: "Le conducteur était un salarié ou un préposé",
    aide: "Le véhicule était affecté à une personne rattachée à la société au moment des faits.",
    paragraphes: (s) => {
      const l = [
        soussigneAvecAdresse(s),
        `titulaire du certificat d'immatriculation du véhicule ${val(
          s.immatriculation,
          9,
        )}, destinataire de l'avis d'infraction référencé ci-dessus pour des faits constatés le ${dateFr(
          s.dateFaits,
        )} à ${heureFr(s.heureFaits)} à ${val(s.lieuFaits, 24)},`,
        `procède, en application de l'article L. 121-6 du code de la route${clauseDelai(
          s,
          " et dans le délai de quarante-cinq jours à compter de l'envoi ou de la remise de l'avis d'infraction",
        )}, à la désignation de la personne physique qui conduisait ce véhicule au moment des faits :`,
        ...blocDesignation(s),
        `La personne désignée ci-dessus était, à la date des faits, ${val(
          s.lienAvecSociete,
          20,
        )} de la société et affectataire du véhicule.`,
        "La présente désignation ne constitue pas une contestation de la réalité de l'infraction.",
      ];
      if (estDansLeChampDe529_10(s)) l.push(phraseDoublePortee);
      return l;
    },
    pieces: () => [],
  },
  "b3-impossible": {
    id: "b3-impossible",
    voie: "designation",
    libelle: "Aucune désignation n'est possible : vol, usurpation de plaque ou force majeure",
    aide: "L'article L. 121-6 du code de la route ne connaît que trois causes d'exonération de l'obligation de désigner : le vol, l'usurpation de plaque d'immatriculation et tout autre événement de force majeure.",
    paragraphes: (s) => {
      const e = evenementDe(s.evenement);
      return [
        soussigneAvecAdresse(s),
        `titulaire du certificat d'immatriculation du véhicule ${val(
          s.immatriculation,
          9,
        )}, destinataire de l'avis d'infraction référencé ci-dessus pour des faits constatés le ${dateFr(
          s.dateFaits,
        )} à ${heureFr(s.heureFaits)} à ${val(s.lieuFaits, 24)},`,
        `expose que la désignation prévue à l'article L. 121-6 du code de la route ne peut être opérée : le véhicule a fait l'objet ${
          e ? e.tournure : ".".repeat(20)
        } le ${dateFr(s.dateEvenement)}.`,
        exposeOuPointilles(s.exposeFaits),
        `Je transmets à cette fin${clauseDelai(
          s,
          ", dans le délai de quarante-cinq jours,",
        )} les pièces établissant cet événement, énumérées ci-dessous.`,
        "La présente lettre ne constitue pas une contestation de la réalité de l'infraction.",
      ];
    },
    pieces: (s) => {
      const e = evenementDe(s.evenement);
      return e ? [e.piece] : [];
    },
  },

  // ─── Branche C : reclamation contre une amende forfaitaire majoree ───
  "c1-avis-initial-jamais-recu": {
    id: "c1-avis-initial-jamais-recu",
    voie: "reclamation",
    libelle: "Je n'ai jamais reçu le premier avis",
    aide: "Vous découvrez l'affaire au stade de l'amende majorée : le premier avis de contravention ne vous est jamais parvenu.",
    paragraphes: (s) => [
      "Par la présente, je forme une réclamation motivée en application de l'article 530, alinéa 2, du code de procédure pénale, à l'encontre de l'avis d'amende forfaitaire majorée référencé ci-dessus.",
      `Cet avis, dont la date d'envoi portée sur le document est le ${dateFr(
        s.datePivot,
      )}, vise le véhicule ${val(s.immatriculation, 9)} pour des faits constatés le ${dateFr(
        s.dateFaits,
      )} à ${val(s.lieuFaits, 24)}.`,
      "Je n'ai jamais reçu l'avis de contravention initial. Je n'ai donc pas été mis en mesure de m'acquitter de l'amende forfaitaire ni de former une requête en exonération dans le délai de quarante-cinq jours de l'article 529-1 du code de procédure pénale.",
      exposeOuPointilles(s.motivation),
      ...(paragrapheConsignationReclamation(s) === null
        ? []
        : [paragrapheConsignationReclamation(s) as string]),
      "En conséquence, je vous demande de bien vouloir constater la recevabilité de la présente réclamation, dont l'effet est d'annuler le titre exécutoire en ce qui concerne l'amende contestée, et de renoncer à l'exercice des poursuites.",
    ],
    pieces: () => [],
  },
  "c2-jamais-connaissance": {
    id: "c2-jamais-connaissance",
    voie: "reclamation",
    libelle: "Je n'ai jamais eu connaissance de l'amende majorée",
    aide: "Vous découvrez l'amende majorée bien après son envoi, par exemple à l'occasion d'une opposition administrative. La question n'est pas « avez-vous reçu ? » mais « l'administration peut-elle prouver que vous avez eu connaissance ? ».",
    paragraphes: (s) => [
      "Par la présente, je forme une réclamation motivée en application de l'article 530, alinéa 2, du code de procédure pénale, à l'encontre de l'avis d'amende forfaitaire majorée référencé ci-dessus.",
      `Cet avis, dont la date d'envoi portée sur le document est le ${dateFr(
        s.datePivot,
      )}, vise le véhicule ${val(s.immatriculation, 9)} pour des faits constatés le ${dateFr(
        s.dateFaits,
      )} à ${val(s.lieuFaits, 24)}.`,
      `Je n'ai eu connaissance de cette amende forfaitaire majorée que le ${dateFr(
        s.dateConnaissance,
      )}, à l'occasion de ${val(s.circonstanceConnaissance, 24)}.`,
      "Conformément au deuxième alinéa de l'article 530 du code de procédure pénale, la réclamation reste recevable tant que la peine n'est pas prescrite, dès lors qu'il ne résulte d'aucun acte d'exécution ni d'aucun autre moyen de preuve que j'ai eu connaissance de l'amende forfaitaire majorée.",
      exposeOuPointilles(s.motivation),
      ...(paragrapheConsignationReclamation(s) === null
        ? []
        : [paragrapheConsignationReclamation(s) as string]),
      "En conséquence, je vous demande de bien vouloir constater la recevabilité de la présente réclamation, dont l'effet est d'annuler le titre exécutoire en ce qui concerne l'amende contestée, et de renoncer à l'exercice des poursuites.",
    ],
    pieces: () => [],
  },
  "c3-changement-adresse": {
    id: "c3-changement-adresse",
    voie: "reclamation",
    libelle: "J'avais déclaré mon changement d'adresse au service d'immatriculation",
    aide: "L'avis majoré est parti à l'ancienne adresse du certificat d'immatriculation alors que le changement avait été déclaré. C'est la seule situation qui écarte la forclusion de trois mois.",
    paragraphes: (s) => [
      "Par la présente, je forme une réclamation motivée en application de l'article 530, alinéa 2, du code de procédure pénale, à l'encontre de l'avis d'amende forfaitaire majorée référencé ci-dessus.",
      `Cet avis, dont la date d'envoi portée sur le document est le ${dateFr(
        s.datePivot,
      )}, vise le véhicule ${val(s.immatriculation, 9)} pour des faits constatés le ${dateFr(
        s.dateFaits,
      )} à ${val(s.lieuFaits, 24)}.`,
      `J'ai déclaré mon changement d'adresse au service d'immatriculation des véhicules le ${dateFr(
        s.dateDeclarationSiv,
      )}, soit avant l'expiration du délai de trois mois prévu au deuxième alinéa de l'article 530 du code de procédure pénale.`,
      exposeOuPointilles(s.motivation),
      ...(paragrapheConsignationReclamation(s) === null
        ? []
        : [paragrapheConsignationReclamation(s) as string]),
      "En conséquence, je vous demande de bien vouloir constater la recevabilité de la présente réclamation, dont l'effet est d'annuler le titre exécutoire en ce qui concerne l'amende contestée, et de renoncer à l'exercice des poursuites.",
    ],
    pieces: () => [
      "Justificatif de la déclaration de changement d'adresse auprès du service d'immatriculation des véhicules",
      "Certificat d'immatriculation portant la nouvelle adresse",
    ],
  },
  "c4-designation-jointe": {
    id: "c4-designation-jointe",
    voie: "reclamation",
    libelle: "Société ou loueur : réclamer et désigner dans le même envoi",
    aide: "Vous êtes une société, l'avis est arrivé au stade majoré et le conducteur est identifié. La désignation vaut alors document du 1° b) de l'article 529-10 et dispense de la consignation.",
    paragraphes: (s) => {
      const transfert = texteResponsabiliteLocataire(s.natureInfraction);
      const l = [
        `${soussigne(s)}, forme une réclamation motivée en application de l'article 530, alinéa 2, du code de procédure pénale, à l'encontre de l'avis d'amende forfaitaire majorée référencé ci-dessus.`,
        `Cet avis, dont la date d'envoi portée sur le document est le ${dateFr(
          s.datePivot,
        )}, vise le véhicule ${val(s.immatriculation, 9)} pour des faits constatés le ${dateFr(
          s.dateFaits,
        )} à ${val(s.lieuFaits, 24)}.`,
        "La personne physique qui conduisait ce véhicule au moment des faits est désignée ci-après, en application de l'article L. 121-6 du code de la route :",
        ...blocDesignation(s),
      ];
      if (s.vehiculeLoue) {
        l.push(
          `Le véhicule était, à la date des faits, loué à la personne désignée ci-dessus au titre du contrat de location n° ${val(
            s.numeroContrat,
            12,
          )}, conclu du ${dateFr(s.debutLocation)} au ${dateFr(s.finLocation)}.`,
        );
        if (transfert) l.push(transfert.phrase);
      }
      l.push(
        "Cette désignation constitue le document prévu au 1° b) de l'article 529-10 du code de procédure pénale et dispense, à ce titre, du versement de la consignation prévue au 2° du même article.",
        exposeOuPointilles(s.motivation),
        "La présente réclamation ne constitue pas une contestation de la réalité de l'infraction.",
        "En conséquence, je vous demande de bien vouloir constater la recevabilité de la présente réclamation, dont l'effet est d'annuler le titre exécutoire en ce qui concerne l'amende contestée, et de renoncer à l'exercice des poursuites.",
      );
      return l;
    },
    pieces: (s) =>
      s.vehiculeLoue ? ["Copie du contrat de location visé ci-dessus"] : [],
  },

  "c5-realite-majoree": {
    id: "c5-realite-majoree",
    voie: "reclamation",
    libelle: "Je conteste la réalité de l'infraction elle-même",
    aide: "Vous ne contestez pas d'avoir reçu l'avis : vous soutenez que l'infraction n'a pas été commise, ou qu'elle l'a été dans des conditions que l'avis ne reflète pas. C'est une réclamation contre l'amende majorée, et non une requête en exonération — la requête en exonération n'existe plus à ce stade.",
    paragraphes: (s) => {
      const l = [
        "Par la présente, je forme une réclamation motivée en application de l'article 530, alinéa 2, du code de procédure pénale, à l'encontre de l'avis d'amende forfaitaire majorée référencé ci-dessus.",
        `Cet avis, dont la date d'envoi portée sur le document est le ${dateFr(
          s.datePivot,
        )}, vise le véhicule ${val(s.immatriculation, 9)} pour des faits constatés le ${dateFr(
          s.dateFaits,
        )} à ${val(s.lieuFaits, 24)}.`,
        exposeOuPointilles(s.exposeFaits),
        "Je conteste la réalité de l'infraction pour les motifs exposés ci-dessus.",
        exposeOuPointilles(s.motivation),
      ];
      const c = paragrapheConsignationReclamation(s);
      if (c !== null) l.push(c);
      l.push(
        "En conséquence, je vous demande de bien vouloir constater la recevabilité de la présente réclamation, dont l'effet est d'annuler le titre exécutoire en ce qui concerne l'amende contestée, et de renoncer à l'exercice des poursuites.",
      );
      return l;
    },
    pieces: () => [],
  },

  // ─── Branche D : recours contre un forfait de post-stationnement ───
  "d1-recours": {
    id: "d1-recours",
    voie: "rapo",
    libelle: "Recours contre un avis de paiement d'un forfait de post-stationnement",
    aide: "Le papier reçu s'intitule « avis de paiement d'un forfait de post-stationnement ». Ce n'est pas une amende : c'est une redevance d'occupation du domaine public.",
    paragraphes: (s) => {
      const moyens = MOYENS_RAPO.filter((m) => s.moyensRapo.includes(m.id));
      // B4 corrige ici. Le gabarit composait « Je soussigné ${identite},
      // representant legal de ... » alors que l'interface MASQUE le champ
      // `identite` des que la personne est morale : toute societe — c'est-a-dire
      // l'audience entiere que la page revendique — obtenait un recours dont la
      // phrase operante portait un blanc au milieu, qu'aucun champ du formulaire
      // ne pouvait combler. Les branches B et C lisaient deja correctement
      // `nomSignataire` : c'etait une incoherence isolee de la branche D.
      //
      // C9 corrige ici aussi. L'art. R. 2333-120-13 ouvre le recours au
      // titulaire du certificat d'immatriculation, mais aussi au locataire, a
      // l'acquereur et a toute personne habilitee par mandat. Affirmer une
      // qualite unique faisait signer une affirmation fausse a un loueur dont le
      // locataire longue duree figure au certificat, comme a un mandataire.
      const qualite = QUALITES_RAPO.find((q) => q.id === s.qualiteRapo) ?? QUALITES_RAPO[0];
      const l = [
        `Je soussigné ${
          s.personne === "morale"
            ? `${val(s.nomSignataire, 22)}, agissant en qualité de ${val(
                s.qualiteSignataire,
                18,
              )} et représentant légal de ${val(s.denominationSociale, 24)}`
            : val(s.identite, 24)
        }, ${qualite.phrase(
          val(s.immatriculation, 9),
        )}, forme le recours administratif préalable obligatoire prévu au VI de l'article L. 2333-87 du code général des collectivités territoriales et organisé par l'article R. 2333-120-13 du même code.`,
        `Ce recours est dirigé contre l'avis de paiement du forfait de post-stationnement n° ${val(
          s.numeroAvis,
          12,
        )}, d'un montant de ${val(s.montantFps, 6)} €, notifié le ${dateFr(
          s.datePivot,
        )}, relatif à un stationnement constaté le ${dateFr(s.dateFaits)} à ${heureFr(
          s.heureFaits,
        )}, ${val(s.lieuFaits, 24)}.${clauseDelai(
          s,
          " Il est formé dans le délai d'un mois à compter de cette notification.",
        )}`,
        "Exposé des faits :",
        exposeOuPointilles(s.exposeFaits),
        "Exposé des moyens :",
      ];
      if (moyens.length > 0) for (const m of moyens) l.push(`— ${m.phrase}`);
      else l.push(exposeOuPointilles(s.motivation));
      if (s.vehiculeLoue) {
        l.push(
          `Le véhicule était, à la date des faits, loué à un tiers au titre du contrat n° ${val(
            s.numeroContrat,
            12,
          )}. Je précise que les mentions du certificat d'immatriculation ne permettent pas l'identification de ce locataire : la substitution prévue au VII de l'article L. 2333-87 du code général des collectivités territoriales ne peut donc trouver à s'appliquer, et je forme le présent recours en ma qualité de titulaire du certificat d'immatriculation.`,
        );
      }
      l.push(
        "Je rappelle enfin que l'agent assermenté qui a établi l'avis de paiement contesté ne peut examiner le présent recours, en application de l'article R. 2333-120-13 du code général des collectivités territoriales.",
        "En conséquence, je vous demande de bien vouloir annuler l'avis de paiement contesté ou, à défaut, de procéder à l'émission d'un avis de paiement rectificatif conformément à l'article R. 2333-120-14 du code général des collectivités territoriales.",
        "À défaut de réponse dans le délai d'un mois à compter de la réception du présent recours, le silence gardé vaudra décision de rejet, ouvrant la voie d'une requête devant le tribunal du stationnement payant dans le délai prévu par l'article R. 2333-120-33 du même code, lequel n'est opposable qu'à la condition d'avoir été mentionné, ainsi que les voies de recours, dans la notification de la décision.",
      );
      return l;
    },
    pieces: (s) => {
      const q = QUALITES_RAPO.find((x) => x.id === s.qualiteRapo);
      const p = MOYENS_RAPO.filter((m) => s.moyensRapo.includes(m.id)).map((m) => m.piece);
      // Une qualite autre que « titulaire » se justifie : c'est elle qui fonde
      // la qualite pour agir, et son absence est une cause de rejet.
      return q && q.piece ? [q.piece, ...p] : p;
    },
  },

  // ─── Voie routee : aucun courrier ───
  "z-routage": {
    id: "z-routage",
    voie: "opposition-routee",
    libelle: "J'ai reçu un avis de condamnation pécuniaire",
    aide: "Une ordonnance pénale a déjà été rendue. L'outil ne rédige pas cette voie : il vous indique quoi faire.",
    paragraphes: () => [NOTE_ROUTAGE_ORDONNANCE_PENALE.texte],
    pieces: () => [],
  },
};

/** Gabarits qui produisent reellement un courrier, DERIVES : la liste affichee
    par l'interface ne peut pas contenir une branche que le moteur refuse. */
export const GABARITS_GENERES: ReadonlyArray<Gabarit> = (
  Object.keys(GABARITS) as SousBranche[]
)
  .map((id) => GABARITS[id])
  .filter((g) => VOIES[g.voie].genereUnCourrier);

// ─────────────────────────────────────────────────────────────────────────────
// AVERTISSEMENTS
//
// Ils vivent HORS du document : l'outil avertit, il ne corrige pas et il ne
// qualifie pas. Aucun n'exprime une chance de succes, aucun ne conseille — c'est
// la limite de l'art. 54 de la loi n° 71-1130, traitee dans le code et pas
// seulement dans un pied de page.
// ─────────────────────────────────────────────────────────────────────────────

export type NiveauAvertissement = "information" | "attention" | "blocage";

export type Avertissement = {
  id: string;
  niveau: NiveauAvertissement;
  texte: string;
};

/** Tous les avertissements d'une saisie. Fonction PURE, sans horloge : la seule
    date de reference est `dateCourrier`, saisie par l'utilisateur. */
export function avertissements(saisie: Saisie): Avertissement[] {
  const s = normaliserSaisie(saisie);
  const v = VOIES[s.voie];
  const a: Avertissement[] = [];

  // -1. AMENDE FORFAITAIRE DELICTUELLE. Ce controle passe avant tous les autres :
  //     il ne sert a rien de discuter d'un delai ou d'une piece jointe si la voie
  //     elle-meme est la mauvaise. Les cinq voies de cet outil sont
  //     contraventionnelles ; une reclamation formee sur l'art. 530 contre un avis
  //     delictuel est irrecevable, et le delai de 30 jours court pendant que
  //     l'utilisateur croit avoir agi. Verbatim releves sur Legifrance le
  //     2026-08-05 : art. 495-19 al. 2 « Dans les trente jours suivant l'envoi de
  //     l'avis invitant l'auteur de l'infraction a payer l'amende forfaitaire
  //     majoree, celui-ci peut former aupres du ministere public une reclamation
  //     motivee [...] » ; art. 495-20 al. 1 « La requete en exoneration prevue a
  //     l'article 495-18 ou la reclamation prevue a l'article 495-19 n'est
  //     recevable que si elle est adressee par lettre recommandee avec demande
  //     d'avis de reception, en utilisant le formulaire joint [...] et si elle est
  //     accompagnee soit d'un document demontrant qu'il a ete acquitte une
  //     consignation prealable [...], soit du recepisse du depot de plainte pour le
  //     delit d'usurpation d'identite prevu a l'article 434-23 du code penal. »
  //     Difference a ne PAS taire : la seule piece alternative a la consignation
  //     est l'usurpation d'IDENTITE — pas les quatre documents du 1° de l'art.
  //     529-10, et pas l'usurpation de PLAQUE de l'art. L. 317-4-1.
  //     Aucun montant n'est publie ici : le bareme de l'amende forfaitaire
  //     delictuelle n'a pas ete verifie a la source, et cet outil ne publie pas
  //     un chiffre qu'il n'a pas lu (meme regle que la branche 5e classe).
  if (s.avisEstDelictuel) {
    a.push({
      id: "amende-forfaitaire-delictuelle",
      niveau: "blocage",
      texte:
        "Votre avis porte la mention « amende forfaitaire délictuelle ». Cet outil ne sait pas produire ce courrier, et celui qu'il produirait serait irrecevable : toutes ses voies reposent sur la procédure contraventionnelle (article 529-2 pour la requête en exonération, article 530 pour la réclamation), alors qu'un délit relève d'une procédure distincte — requête en exonération de l'article 495-18 du code de procédure pénale, réclamation de l'article 495-19 dans les trente jours suivant l'ENVOI de l'avis majoré. L'article 495-20 en fixe la recevabilité : lettre recommandée avec avis de réception, formulaire joint à l'avis, et consignation préalable — la seule pièce qui en dispense étant le récépissé de plainte pour usurpation d'identité (article 434-23 du code pénal), et non les quatre documents du 1° de l'article 529-10. Adressez-vous au service indiqué sur votre avis, ou au téléservice mentionné par l'article 495-20.",
    });
  }

  // 0. Coherence des dates, avant toute conclusion de delai. Deux controles de
  //    VRAISEMBLANCE, pas de droit : une date pivot posterieure a la date du
  //    courrier decrit un avis envoye APRES la lettre qui le conteste — l'une
  //    des deux est fausse — et une date au-dela de la borne de saisie est une
  //    faute de frappe qui produirait une echeance fantaisiste (« 1er fevrier
  //    10000 »). On ne conclut rien sur le fond : on signale que les echeances
  //    calculees sur ces dates ne veulent rien dire.
  const pivotLisible = jourUTC(s.datePivot) !== null;
  const courrierLisible = jourUTC(s.dateCourrier) !== null;
  if (v.genereUnCourrier && pivotLisible && courrierLisible && s.datePivot > s.dateCourrier) {
    a.push({
      id: "dates-incoherentes",
      niveau: "attention",
      texte: `La date portée sur l'avis (${dateFr(s.datePivot)}) est postérieure à la date de votre courrier (${dateFr(
        s.dateCourrier,
      )}) : un avis ne peut pas avoir été envoyé après le courrier qui le conteste. Vérifiez ces deux dates — les échéances affichées n'ont aucun sens tant qu'elles se contredisent.`,
    });
  }
  const invraisemblables = [
    pivotLisible && s.datePivot > SAISIE_DATE_MAX
      ? `la date portée sur l'avis (${dateFr(s.datePivot)})`
      : null,
    v.genereUnCourrier && courrierLisible && s.dateCourrier > SAISIE_DATE_MAX
      ? `la date de votre courrier (${dateFr(s.dateCourrier)})`
      : null,
  ].filter((x): x is string => x !== null);
  if (invraisemblables.length > 0) {
    a.push({
      id: "date-invraisemblable",
      niveau: "attention",
      texte: `Date improbable : ${invraisemblables.join(" et ")} ${
        invraisemblables.length > 1 ? "dépassent" : "dépasse"
      } le ${dateFr(SAISIE_DATE_MAX)}. C'est très probablement une faute de frappe, et les échéances calculées dessus n'ont aucun sens.`,
    });
  }

  // 1. Delai. On n'affirme jamais « hors delai » sur une saisie incomplete :
  //    l'utilisateur renoncerait a un recours encore ouvert.
  //
  //    C2 corrige ici. Le bloc appliquait le delai de la VOIE a toutes ses
  //    sous-branches, y compris a C2 « je n'ai jamais eu connaissance de
  //    l'amende majoree ». Or c'est precisement la sous-branche qui invoque la
  //    soupape du deuxieme alinea de l'art. 530 : tant que la peine n'est pas
  //    prescrite et qu'il ne resulte d'aucun acte d'execution ni d'aucun autre
  //    moyen de preuve que l'interesse a eu connaissance de l'amende, la
  //    reclamation RESTE RECEVABLE. L'outil affichait donc en rouge « hors
  //    delai » a cote d'un courrier qui venait, deux paragraphes plus haut,
  //    d'exposer correctement le contraire — et pouvait faire renoncer a un
  //    recours ouvert pendant trois ans, ce que le module dit vouloir eviter.
  const soupapePrescription = s.sousBranche === "c2-jamais-connaissance";
  const hors = estHorsDelai(s.datePivot, v.delai, s.dateCourrier);
  const e = calculerEcheance(s.datePivot, v.delai);
  if (hors === true && e && !soupapePrescription) {
    a.push(
      v.genereUnCourrier
        ? {
            id: "hors-delai",
            niveau: "attention",
            texte: `La date portée sur votre courrier est postérieure au ${dateFr(e.echeance)}, terme du délai de ${e.fondement}. Le courrier reste rédigeable, mais le délai est un fait : c'est l'autorité destinataire qui apprécie la recevabilité.`,
          }
        : {
            // Branche ROUTEE : aucun courrier n'est redige, et la date de
            // reference du verdict (`dateCourrier`, posee a la date du jour par
            // l'interface) n'est affichee nulle part. L'avertissement parle donc
            // de l'ECHEANCE, jamais d'un « courrier », et rappelle la date
            // saisie qui la fonde.
            id: "hors-delai",
            niveau: "attention",
            texte: `D'après la date saisie (${dateFr(s.datePivot)}), l'échéance du délai de ${e.fondement} était le ${dateFr(
              e.echeance,
            )} : elle est dépassée. Cette voie ne fait l'objet d'aucun courrier ici — le délai est un fait, et c'est l'autorité destinataire qui apprécie la recevabilité de la démarche, formée selon les modalités portées sur la notification.`,
          },
    );
  }
  if (hors === true && e && soupapePrescription) {
    const p = calculerEcheance(s.datePivot, "prescription-peine");
    a.push({
      id: "hors-delai-soupape-530",
      niveau: "information",
      texte: `Le délai de trente jours de l'article 530, alinéa 2, du code de procédure pénale à expiré le ${dateFr(
        e.echeance,
      )}. Ce n'est pas, ici, une forclusion : c'est la sous-branche même que vous avez retenue qui invoque le deuxième alinéa de ce texte, aux termes duquel la réclamation reste recevable tant que la peine n'est pas prescrite, dès lors qu'il ne résulte d'aucun acte d'exécution ni d'aucun autre moyen de preuve que vous avez eu connaissance de l'amende forfaitaire majorée.${
        p ? ` La prescription de la peine intervient le ${dateFr(p.echeance)}.` : ""
      } C'est l'autorité destinataire qui apprécie la recevabilité.`,
    });
  }

  // 2. Designation : les trois elements. L. 121-6 exige l'identite et l'adresse ;
  //    le 1° b) de 529-10 exige EN PLUS la reference du permis, et son absence est
  //    la premiere cause de rejet chez un loueur.
  const designe =
    s.sousBranche === "b1-locataire" ||
    s.sousBranche === "b2-salarie" ||
    s.sousBranche === "c4-designation-jointe" ||
    s.sousBranche === "a1-conducteur";
  if (designe) {
    if (!s.conducteurNom.trim() || !s.conducteurAdresse.trim()) {
      a.push({
        id: "designation-incomplete",
        niveau: "blocage",
        texte:
          "L'article L. 121-6 du code de la route exige l'identité ET l'adresse de la personne qui conduisait le véhicule. Une désignation imprécise est une désignation nulle.",
      });
    }
    if (!s.conducteurPermis.trim()) {
      a.push({
        id: "designation-sans-permis",
        niveau: "attention",
        texte:
          "La référence du permis de conduire n'est pas exigée par l'article L. 121-6 du code de la route, qui demande l'identité et l'adresse. Elle l'est en revanche par le 1° b) de l'article 529-10 du code de procédure pénale, et l'ANTAI la demande. Sans elle, ce courrier vaut désignation mais ne vaut pas pièce de recevabilité d'une requête ou d'une réclamation.",
      });
    }
  }

  // 3. B3 : l'art. L. 121-6 ne connaît que trois causes d'exoneration de
  //    l'obligation de designer. Produire une declaration de cession en croyant
  //    s'en preserver expose a la contravention de non-designation.
  if (s.sousBranche === "a2-evenement" || s.sousBranche === "b3-impossible") {
    if (s.evenement === "") {
      a.push({
        id: "evenement-non-precise",
        niveau: "blocage",
        texte:
          "Aucun événement n'est choisi : le courrier ne peut ni nommer le fait invoqué, ni désigner la pièce qui l'établit. Le document reste imprimable, mais ces deux lignes resteront à compléter à la main.",
      });
    }
  }
  if (s.sousBranche === "b3-impossible") {
    const ev = evenementDe(s.evenement);
    if (ev && !ev.exonereDesignation) {
      a.push({
        id: "evenement-n-exonere-pas-designation",
        niveau: "attention",
        texte: `L'article L. 121-6 du code de la route énumère trois causes d'exonération de l'obligation de désigner : le vol, l'usurpation de plaque d'immatriculation et tout autre événement de force majeure. « ${ev.label} » n'en fait pas partie : cette pièce peut fonder une requête en exonération, elle n'éteint pas l'obligation de désigner.`,
      });
    }
  }

  // 4. Champ de l'art. 529-10 et consignation.
  //
  //    B1 corrige ici. Le bloc etait garde par `s.sousBranche === "a3-realite"`,
  //    si bien que les quatre sous-branches de RECLAMATION — celles ou la
  //    consignation vaut 375 EUR et non 135 EUR — n'affichaient ni montant, ni
  //    avertissement. La regle ne depend pourtant ni de la voie ni de la
  //    sous-branche : elle depend de ce que le courrier produit, et c'est
  //    `consignationRequise` qui le dit.
  if (VOIES[s.voie].genereUnCourrier && s.voie !== "rapo") {
    const cons = consignationRequise(s);
    if (!estDansLeChampDe529_10(s)) {
      a.push({
        id: "hors-champ-529-10",
        niveau: "information",
        texte:
          "Aucune consignation n'est exigée : l'article 529-10 du code de procédure pénale suppose que l'avis vous ait été adressé comme titulaire du certificat d'immatriculation ET que l'infraction figure dans la liste de l'article L. 121-3 du code de la route. Hors de ce champ, ni consignation, ni lettre recommandée, ni formulaire joint ne sont exigés à peine d'irrecevabilité.",
      });
    } else if (cons.document !== null) {
      a.push({
        id: "consignation-dispensee",
        niveau: "information",
        texte: `Aucune consignation n'est à verser : ce courrier porte le document prévu au 1° ${cons.document.lettre}) de l'article 529-10 du code de procédure pénale — ${cons.document.libelle}. Le 1° et le 2° de cet article sont les deux termes d'une alternative : produire l'un dispense de l'autre.`,
      });
    } else if (cons.requise) {
      const c = cons.resultat;
      const voieLibelle =
        s.voie === "reclamation" ? "réclamation" : "contestation";
      const fondement =
        s.voie === "reclamation"
          ? "le troisième alinéa de l'article 530 du code de procédure pénale, qui renvoie à l'article 529-10 et conclut « à défaut de quoi elle est irrecevable »"
          : "l'article 529-10 du code de procédure pénale";
      a.push({
        id: "consignation-requise",
        // BLOCAGE et non « attention » : sans document du 1° ni consignation du
        // 2°, l'irrecevabilite n'est pas un risque, elle est ecrite dans le
        // texte. Elle se decouvre en outre bien apres l'expiration du delai.
        niveau: s.consignationVersee ? "information" : "blocage",
        // LE TEXTE SUIT LA CASE COCHEE, pas seulement le niveau. La version
        // precedente ne faisait varier que le niveau : l'utilisateur qui venait
        // de declarer avoir verse la consignation lisait toujours « elle
        // suppose donc le versement… elle se paie avec la carte de consignation
        // jointe » — a cote d'un courrier qui, lui, ecrivait « j'ai acquitte ».
        // La variante « versee » rappelle ce qui reste a faire : joindre le
        // justificatif et conserver le talon. Aucun montant net n'est calcule
        // (voir IMPUTATION_CONSIGNATION).
        texte: s.consignationVersee
          ? `Vous déclarez avoir versé la consignation préalable prévue au 2° de l'article 529-10 du code de procédure pénale${
              c.calculable ? `, d'un montant de ${eur(c.montant)}` : ""
            }. Joignez le justificatif du versement à votre envoi — il figure dans la liste des pièces jointes du courrier — et conservez le talon de la carte de consignation. Pour reprendre les termes du texte, ${VERBATIM_CONSIGNATION} ; elle est reversée en cas de classement sans suite ou de relaxe.`
          : c.calculable
            ? `Cette ${voieLibelle} entre dans le champ de l'article 529-10 du code de procédure pénale et ne porte aucun des documents énumérés à son 1°. Elle suppose donc le versement de la consignation préalable de son 2°, d'un montant de ${eur(
                c.montant,
              )} — c'est ${fondement}. Elle se paie avec la carte de consignation jointe au formulaire de votre avis : ce module ne produit pas ce talon.`
            : `${c.motif} Fondement : ${fondement}.`,
      });
    }
  }

  // 5. Forclusion de trois mois propre aux contraventions routieres. Ce n'est pas
  //    un delai de recours : c'est une forclusion qui referme la soupape de
  //    prescription. La sous-branche C3 est la seule a l'ecarter.
  if (
    s.voie === "reclamation" &&
    s.contraventionCodeDeLaRoute &&
    s.afmEnvoyeeLrarAdresseCertificat &&
    s.sousBranche !== "c3-changement-adresse"
  ) {
    const f = calculerEcheance(s.datePivot, "forclusion-afm-routiere");
    const depasse = estHorsDelai(s.datePivot, "forclusion-afm-routiere", s.dateCourrier);
    if (f) {
      a.push({
        id: "forclusion-afm-routiere",
        niveau: depasse === true ? "attention" : "information",
        texte:
          depasse === true
            ? `L'avis d'amende forfaitaire majorée a été envoyé en recommandé à l'adresse figurant sur le certificat d'immatriculation, pour une contravention au code de la route : la réclamation n'est plus recevable depuis le ${dateFr(f.echeance)}, sauf à justifier d'un changement d'adresse déclaré au service d'immatriculation avant cette date.`
            : `Pour une contravention au code de la route dont l'avis majoré a été envoyé en recommandé à l'adresse du certificat d'immatriculation, la réclamation cesse d'être recevable le ${dateFr(f.echeance)}. Ce n'est pas un délai de recours de trois mois : c'est une forclusion qui referme la soupape de prescription.`,
      });
    }
  }

  // 6. Motivation et expose : exiges a peine d'irrecevabilite, chacun par son
  //    texte. On le dit comme un blocage, parce que c'en est un.
  if (s.voie === "reclamation" && !s.motivation.trim()) {
    a.push({
      id: "reclamation-non-motivee",
      niveau: "blocage",
      texte:
        "L'alinéa 2 de l'article 530 du code de procédure pénale exige une réclamation MOTIVÉE, et l'article 530-1 permet au ministère public d'aviser l'intéressé de l'irrecevabilité d'une réclamation non motivée.",
    });
  }
  if (s.voie === "rapo") {
    if (!s.exposeFaits.trim()) {
      a.push({
        id: "rapo-sans-expose",
        niveau: "blocage",
        texte:
          "L'article R. 2333-120-13 du code général des collectivités territoriales exige un exposé des faits à peine d'irrecevabilité.",
      });
    }
    if (s.moyensRapo.length === 0 && !s.motivation.trim()) {
      a.push({
        id: "rapo-sans-moyens",
        niveau: "blocage",
        texte:
          "L'article R. 2333-120-13 du code général des collectivités territoriales exige un exposé des moyens à peine d'irrecevabilité.",
      });
    }
    if (s.vehiculeLoue) {
      a.push({
        id: "fps-loueur-levier-contractuel",
        niveau: "information",
        texte: NOTE_FPS_LOUEUR.texte,
      });
    }
  }

  // 7. Formulations valant aveu, detectees dans les champs libres.
  //
  //    L'identifiant porte le CHAMP d'origine, et la liste est dedoublonnee.
  //    Sans cela, la meme phrase ecrite dans les deux zones — le seul cas ou
  //    l'interface les expose ensemble est la branche D — produisait deux
  //    avertissements de meme `id`, rendus avec `key={a.id}` : deux cles React
  //    identiques entre freres.
  const detectees: Array<{ champ: string; expression: string; motif: string }> = [
    ...detecterFormulationsInterdites(s.exposeFaits).map((f) => ({ champ: "expose", ...f })),
    ...detecterFormulationsInterdites(s.motivation).map((f) => ({ champ: "motivation", ...f })),
  ];
  const vues = new Set<string>();
  for (const f of detectees) {
    const id = `formulation-${f.champ}-${f.expression.replace(/[^a-z]+/gi, "-")}`;
    if (vues.has(id)) continue;
    vues.add(id);
    a.push({
      id,
      niveau: "attention",
      texte: `Votre texte contient « ${f.expression} » : ${f.motif}.`,
    });
  }

  // 8. La voie dematerialisee existe et elle est recevable de plein droit. Ne pas
  //    vendre le courrier comme la seule voie : ce serait faux.
  if (s.voie === "designation") {
    a.push({
      id: "voie-dematerialisee",
      niveau: "information",
      texte:
        "La même démarche est réalisable en ligne, à l'unité sur le téléservice usagers de l'ANTAI, et en masse sur son espace gestionnaire de flotte. La voie dématérialisée est prévue par l'article L. 121-6 du code de la route, elle est recevable de plein droit et elle dispense des frais de recommandé.",
    });
    a.push({
      id: "designer-avant-contester",
      niveau: "information",
      texte: NOTE_DESIGNER_NEST_PAS_CONTESTER.texte,
    });
  }

  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITION DU COURRIER
// ─────────────────────────────────────────────────────────────────────────────

export type Courrier = {
  voie: DefinitionVoie;
  gabarit: Gabarit;
  entete: string[];
  destinataire: string[];
  lieuEtDate: string;
  mentionEnvoi: string;
  objet: string;
  reference: string;
  corps: string[];
  pieces: string[];
  formule: string;
  signature: string[];
  pied: string[];
};

const enTete = (s: Saisie): string[] => {
  const l: string[] = [];
  if (s.personne === "morale") {
    l.push(`${val(s.denominationSociale, 26)} — SIREN ${val(s.siren, 9)}`);
    l.push(
      `Représentée par ${val(s.nomSignataire, 22)}, en qualité de ${val(s.qualiteSignataire, 18)}`,
    );
  } else {
    l.push(val(s.identite, 26));
  }
  l.push(`${val(s.adresse, 30)}`);
  l.push(`${val(s.codePostal, 5)} ${val(s.ville, 18)}`);
  if (s.personne === "morale") {
    l.push("Adresse telle qu'inscrite au certificat d'immatriculation du véhicule.");
  }
  l.push(`${val(s.email, 22)} — ${val(s.telephone, 12)}`);
  return l;
};

/** Bloc destinataire. JAMAIS pre-rempli : trois lignes de pointilles quand
    l'utilisateur n'a pas recopie l'adresse de son avis. */
const blocDestinataire = (s: Saisie): string[] => {
  const t = s.destinataireBloc.trim();
  return t ? t.split("\n").map((x) => x.trim()) : [".".repeat(34), ".".repeat(34), ".".repeat(34)];
};

/**
 * Compose le courrier. Renvoie null pour une sous-branche que l'outil ne rédige
 * pas : l'opposition a une ordonnance penale se forme par declaration selon les
 * modalites notifiees par le greffe, et livrer une lettre libre ferait courir un
 * risque de forclusion sur un delai de trente jours. L'appelant affiche alors
 * `NOTE_ROUTAGE_ORDONNANCE_PENALE`.
 */
export function composerCourrier(saisie: Saisie): Courrier | null {
  const s = normaliserSaisie(saisie);
  const voie = VOIES[s.voie];
  if (!voie.genereUnCourrier) return null;
  const gabarit = GABARITS[s.sousBranche];

  // Les pieces obligatoires de la voie sont EN TETE et non supprimables :
  // l'avis d'amende forfaitaire majore pour une reclamation (530 al. 3), l'avis
  // de paiement et le certificat d'immatriculation pour un recours contre un
  // forfait de post-stationnement (R. 2333-120-13). Les doublons sont ecartes :
  // une meme piece citee deux fois fait douter de la liste entiere.
  const pieces: string[] = [];
  for (const p of [...voie.piecesObligatoires(s), ...gabarit.pieces(s)]) {
    if (!pieces.includes(p)) pieces.push(p);
  }

  return {
    voie,
    gabarit,
    entete: enTete(s),
    destinataire: blocDestinataire(s),
    lieuEtDate: `${val(s.lieu, 14)}, le ${dateFr(s.dateCourrier)}`,
    mentionEnvoi: voie.formeEnvoi,
    objet: voie.objet(s),
    reference: `Référence : avis n° ${val(s.numeroAvis, 12)}${
      s.numeroDossier.trim() ? ` — dossier n° ${s.numeroDossier.trim()}` : ""
    }`,
    corps: gabarit.paragraphes(s),
    pieces,
    formule: voie.formule,
    signature: [
      s.personne === "morale"
        ? `${val(s.nomSignataire, 22)}, ${val(s.qualiteSignataire, 18)}`
        : val(s.identite, 24),
      "Signature manuscrite :",
    ],
    pied: [
      `Modèle de courrier généré sur lexio.rent/outils/lettre-contestation-amende — textes en vigueur à la date de mise à jour du ${dateFr(META.miseAJour)}.`,
      MENTION_DEONTOLOGIQUE,
    ],
  };
}

/** Version texte brut, pour le bouton « Copier le texte » et pour le controle
    des mots interdits. Un seul assemblage : le controle porte donc exactement
    sur ce que l'utilisateur enverra. */
export function courrierEnTexte(c: Courrier): string {
  const l: string[] = [
    ...c.entete,
    "",
    ...c.destinataire,
    "",
    c.lieuEtDate,
    "",
    c.mentionEnvoi,
    "",
    `Objet : ${c.objet}`,
    c.reference,
    "",
    ...c.corps,
    "",
    "Pièces jointes :",
  ];
  if (c.pieces.length === 0) l.push("— (aucune)");
  else c.pieces.forEach((p, i) => l.push(`${i + 1}. ${p}`));
  l.push("", c.formule, "", ...c.signature, "", ...c.pied);
  return l.join("\n");
}

/**
 * SPECIMENS — la raison pour laquelle ce module rend les gabarits COMPLETS sous
 * forme de donnees pures.
 *
 * Sur ce groupe de requetes, le troisieme resultat d'une SERP a mille recherches
 * par mois est un simple fichier PDF : un document uniquement peint par
 * JavaScript apres interaction n'est pas competitif, et un document rendu dans
 * un composant client derriere une frontiere `Suspense` ne l'est pas davantage.
 * `specimens()` produit chaque modele avec ses pointilles a completer, sans
 * horloge et sans etat, pour que la page SERVEUR l'imprime dans le HTML statique
 * — hors de toute frontiere `Suspense`, donc lisible par un moteur et par un
 * visiteur sans JavaScript, et imprimable au stylo tel quel.
 */
export function specimens(): ReadonlyArray<{ gabarit: Gabarit; courrier: Courrier }> {
  const out: Array<{ gabarit: Gabarit; courrier: Courrier }> = [];
  for (const g of GABARITS_GENERES) {
    const c = composerCourrier(saisieVide(g.id));
    if (c) out.push({ gabarit: g, courrier: c });
  }
  return out;
}

/** Mots interdits reellement presents dans un courrier compose. Le controle
    porte sur le TEXTE ASSEMBLE, normalise : « Exonération » en tete d'objet ne
    doit pas passer au travers d'une recherche de « exoneration ». */
export function motsInterditsTrouves(c: Courrier): string[] {
  const n = normaliserTexte(courrierEnTexte(c));
  return c.voie.motsInterdits.filter((m) => n.includes(normaliserTexte(m)));
}

// ─────────────────────────────────────────────────────────────────────────────
// CAS DE CONTROLE
//
// Jeu de regression ET contenu editorial : la page l'affiche tel quel, avec le
// resultat REEL de chaque rejeu. La SERP recompense l'outil qui montre sa
// methode, pas celui qui crache un modele.
//
// `attendu` est une CHAÎNE pour tous les cas, y compris les montants et les
// dates. Deux raisons : la comparaison est exacte, sans tolerance a regler cas
// par cas ; et le tableau de la page se rend sans convertisseur, donc sans
// endroit ou un formatage pourrait masquer une divergence.
// ─────────────────────────────────────────────────────────────────────────────

export type MesureControle =
  /** Date limite d'une demarche. */
  | { mesure: "echeance"; depart: string; delai: DelaiId }
  /** Date limite de PAIEMENT par telepaiement automatise ou timbre dematerialise :
      quinze jours qui commencent A L'ISSUE du delai principal (R. 49-3-1). */
  | { mesure: "echeance-telepaiement"; depart: string; delaiPrincipal: DelaiId }
  /** Montant de la contravention de non-designation, derive du bareme. */
  | { mesure: "montant-non-designation"; stade: StadeAmende; personne: Personne }
  /** Etiquette qui voyage avec ce montant. */
  | { mesure: "etiquette-non-designation"; stade: StadeAmende; personne: Personne }
  /** Montant de la consignation prealable. */
  | { mesure: "consignation"; classe: ClasseContravention; stade: "forfaitaire" | "majoree" }
  /** Majoration d'un forfait de post-stationnement impaye. */
  | { mesure: "majoration-fps"; restantDu: number }
  /** Mots dont la presence dans un document est une faute de regime. */
  | { mesure: "mots-interdits"; sousBranche: SousBranche }
  /** Presence d'un avertissement donne pour une saisie donnee. */
  | { mesure: "avertissement"; sousBranche: SousBranche; retouches: Partial<Saisie>; id: string }
  /** Deux sous-branches peuvent-elles figurer dans le meme courrier ? */
  | { mesure: "combinaison"; a: SousBranche; b: SousBranche }
  /** Champ d'application de l'art. 529-10. */
  | {
      mesure: "champ-529-10";
      destinataireEstTitulaire: boolean;
      infractionListeL121_3: boolean;
    }
  /** Article de transfert de responsabilite vers le locataire. */
  | { mesure: "texte-transfert-locataire"; nature: NatureInfraction };

export type CasDeControle = {
  /** Affiche tel quel dans le tableau de la page. */
  intitule: string;
  mesure: MesureControle;
  attendu: string;
  /** Vrai UNIQUEMENT si la valeur attendue vient d'un chiffre officiellement
      publie. Tout le reste est une derivation d'un texte, mise en regression
      pour figer une lecture — ce n'est pas une preuve. */
  officiel: boolean;
  source: string;
};

export const CAS_DE_CONTROLE: ReadonlyArray<CasDeControle> = [
  // ── Delais ──
  {
    intitule:
      "Avis de contravention envoyé le 1er mars 2026 : requête en exonération jusqu'au…",
    mesure: { mesure: "echeance", depart: "2026-03-01", delai: "exoneration" },
    attendu: "2026-04-15",
    officiel: false,
    source:
      "Dérivation du délai de 45 jours des art. 529-1 et 529-2 du code de procédure pénale, compté à partir de l'envoi",
  },
  {
    intitule:
      "Le même avis, payé par télépaiement : 45 jours + 15 jours pour PAYER, sans allonger le délai pour contester",
    mesure: {
      mesure: "echeance-telepaiement",
      depart: "2026-03-01",
      delaiPrincipal: "paiement-forfaitaire",
    },
    attendu: "2026-04-30",
    officiel: false,
    source:
      "Art. R. 49-3-1 du code de procédure pénale : quinze jours à l'issue du délai de l'art. 529-1, pour le paiement seul",
  },
  {
    intitule: "Amende forfaitaire majorée envoyée le 1er mars 2026 : réclamation jusqu'au…",
    mesure: { mesure: "echeance", depart: "2026-03-01", delai: "reclamation" },
    attendu: "2026-03-31",
    officiel: false,
    source: "Dérivation du délai de 30 jours de l'art. 530, alinéa 2, compté à partir de l'envoi",
  },
  {
    intitule:
      "La même amende majorée, payée par télépaiement : 30 jours + 15 jours, soit un mois et demi pour payer",
    mesure: {
      mesure: "echeance-telepaiement",
      depart: "2026-03-01",
      delaiPrincipal: "reclamation",
    },
    attendu: "2026-04-15",
    officiel: false,
    source:
      "Art. R. 49-3-1, qui vise aussi l'art. 530 : quinze jours à l'issue du délai de trente jours. Les plans d'articles ne tiraient du texte que le 45 + 15 de l'amende forfaitaire",
  },
  {
    intitule:
      "Amende majorée routière envoyée en recommandé à l'adresse du certificat d'immatriculation le 1er mars 2026 : forclusion au…",
    mesure: { mesure: "echeance", depart: "2026-03-01", delai: "forclusion-afm-routiere" },
    attendu: "2026-06-01",
    officiel: false,
    source:
      "Dérivation de la forclusion de trois mois de l'art. 530, alinéa 2 — comptée en MOIS et non en jours",
  },
  {
    intitule: "Forfait de post-stationnement notifié le 1er mars 2026 : recours jusqu'au…",
    mesure: { mesure: "echeance", depart: "2026-03-01", delai: "rapo" },
    attendu: "2026-04-01",
    officiel: false,
    source:
      "Dérivation du délai d'un mois de l'art. R. 2333-120-13 du CGCT, compté à partir de la notification",
  },
  {
    intitule: "Le même forfait de post-stationnement : à payer avant le…",
    mesure: { mesure: "echeance", depart: "2026-03-01", delai: "paiement-fps" },
    attendu: "2026-06-01",
    officiel: false,
    source: "Dérivation du délai de trois mois de l'art. L. 2333-87, IV, du CGCT",
  },
  {
    intitule:
      "Avis d'infraction (contrôle automatique) envoyé à une société le 1er mars 2026 : désignation jusqu'au…",
    mesure: { mesure: "echeance", depart: "2026-03-01", delai: "designation" },
    attendu: "2026-04-15",
    officiel: false,
    source:
      "Dérivation du délai de 45 jours de l'art. L. 121-6 du code de la route, compté de l'envoi ou de la remise",
  },
  {
    intitule:
      "Délai en mois : forfait notifié le 31 janvier 2026, recours jusqu'au dernier jour de février",
    mesure: { mesure: "echeance", depart: "2026-01-31", delai: "rapo" },
    attendu: "2026-02-28",
    officiel: false,
    source:
      "Cas limite du comptage en mois : le quantième 31 n'existe pas en février, il est ramené au dernier jour du mois — un débordement sur mars declarerait le recours hors délai",
  },

  // ── Baremes ──
  {
    intitule:
      "Non-désignation, personne morale, stade minoré : 90 € × 5",
    mesure: { mesure: "montant-non-designation", stade: "minoree", personne: "morale" },
    attendu: "450",
    officiel: true,
    source:
      "Barème publié par l'ANTAI (450 / 675 / 1 875 €), reproduit par la dérivation R. 49-9 CPP × art. 530-3, alinéa 2, CPP",
  },
  {
    intitule: "Non-désignation, personne morale, stade forfaitaire : 135 € × 5",
    mesure: { mesure: "montant-non-designation", stade: "forfaitaire", personne: "morale" },
    attendu: "675",
    officiel: true,
    source:
      "Barème publié par l'ANTAI, reproduit par la dérivation R. 49 CPP × art. 530-3, alinéa 2, CPP",
  },
  {
    intitule: "Non-désignation, personne morale, stade majoré : 375 € × 5",
    mesure: { mesure: "montant-non-designation", stade: "majoree", personne: "morale" },
    attendu: "1875",
    officiel: true,
    source:
      "Barème publié par l'ANTAI, reproduit par la dérivation R. 49-7 CPP × art. 530-3, alinéa 2, CPP",
  },
  {
    intitule:
      "Non-désignation, personne morale, maximum devant le tribunal de police : 750 € × 5",
    mesure: { mesure: "montant-non-designation", stade: "maximum-tribunal", personne: "morale" },
    attendu: "3750",
    officiel: true,
    source:
      "Maximum publié par l'ANTAI, reproduit par la dérivation art. 131-13, 4°, CP × art. 131-41 CP",
  },
  {
    intitule:
      "Non-désignation, représentant légal personne physique, maximum devant le tribunal de police",
    mesure: {
      mesure: "montant-non-designation",
      stade: "maximum-tribunal",
      personne: "physique",
    },
    attendu: "750",
    officiel: true,
    source: "Maximum publié par l'ANTAI (750 €), reproduit par l'art. 131-13, 4°, du code pénal",
  },
  {
    intitule:
      "L'étiquette de ces montants nomme la non-désignation, jamais l'infraction constatée",
    mesure: { mesure: "etiquette-non-designation", stade: "forfaitaire", personne: "morale" },
    attendu: ETIQUETTE_NON_DESIGNATION,
    officiel: false,
    source:
      "Interdiction absolue de la note de cadrage : ne jamais afficher 675 € en face d'un excès de vitesse. Les 675 € sont le prix de l'oubli de désignation",
  },
  {
    intitule:
      "Consignation d'une requête en exonération, contravention de 4e classe : montant de l'amende forfaitaire",
    mesure: { mesure: "consignation", classe: "4e", stade: "forfaitaire" },
    attendu: "135",
    officiel: false,
    source:
      "Art. 529-10, 2°, CPP : « un montant égal à celui de l'amende forfaitaire » — lu dans le barème, jamais recopié",
  },
  {
    intitule:
      "Consignation d'une réclamation, contravention de 4e classe : le retard triple la consignation",
    mesure: { mesure: "consignation", classe: "4e", stade: "majoree" },
    attendu: "375",
    officiel: false,
    source: "Art. 529-10, 2°, CPP, stade majoré — art. R. 49-7 CPP",
  },
  {
    intitule:
      "Consignation d'une contravention de 1re classe au stade majoré, désormais chiffrable",
    mesure: { mesure: "consignation", classe: "1re", stade: "majoree" },
    attendu: "33",
    officiel: false,
    source:
      "Art. R. 49-7 CPP, 1re classe : 33 €. Le montant a été relevé à la source ; le trou du barème des trois premières classes est comblé, et « non calculable » n'est plus la réponse",
  },
  {
    intitule: "Amende forfaitaire minorée de 2e classe",
    mesure: { mesure: "consignation", classe: "2e", stade: "majoree" },
    attendu: "75",
    officiel: false,
    source: "Art. R. 49-7 CPP, 2e classe : 75 €",
  },
  {
    intitule: "Amende forfaitaire majorée de 3e classe",
    mesure: { mesure: "consignation", classe: "3e", stade: "majoree" },
    attendu: "180",
    officiel: false,
    source: "Art. R. 49-7 CPP, 3e classe : 180 €",
  },
  {
    intitule:
      "Forfait de post-stationnement de 17 € impayé : la majoration reste au plancher de 50 €",
    mesure: { mesure: "majoration-fps", restantDu: 17 },
    attendu: "50",
    officiel: false,
    source:
      "Art. R. 2333-120-16 CGCT : 20 % du restant du, sans pouvoir être inférieur à 50 € — ici le plancher joue et vaut trois fois le forfait",
  },
  {
    intitule: "Forfait de post-stationnement de 400 € impayé : 20 % du restant dû",
    mesure: { mesure: "majoration-fps", restantDu: 400 },
    attendu: "80",
    officiel: false,
    source: "Art. R. 2333-120-16 CGCT, part proportionnelle au-delà du plancher",
  },

  // ── Regles de branche ──
  {
    intitule:
      "Recours contre un forfait de post-stationnement : le document ne contient ni « ministère public », ni « exonération », ni « consignation », ni « point »",
    mesure: { mesure: "mots-interdits", sousBranche: "d1-recours" },
    attendu: "aucun",
    officiel: false,
    source:
      "Le forfait de post-stationnement est une redevance d'occupation du domaine public depuis le 1er janvier 2018 : ces quatre mots appartiennent à un autre ordre juridique",
  },
  {
    intitule:
      "Désignation par une société sans référence du permis de conduire : l'avertissement du 1° b) est levé",
    mesure: {
      mesure: "avertissement",
      sousBranche: "b1-locataire",
      retouches: { conducteurNom: "Martin Dupont", conducteurAdresse: "12 rue des Lilas, Nantes" },
      id: "designation-sans-permis",
    },
    attendu: "present",
    officiel: false,
    source:
      "L'art. L. 121-6 exige identité et adresse ; le 1° b) de l'art. 529-10 exige en plus la référence du permis. C'est la première cause de rejet chez un loueur",
  },
  {
    intitule:
      "La même désignation, référence du permis renseignée : l'avertissement disparaît",
    mesure: {
      mesure: "avertissement",
      sousBranche: "b1-locataire",
      retouches: {
        conducteurNom: "Martin Dupont",
        conducteurAdresse: "12 rue des Lilas, Nantes",
        conducteurPermis: "0123456789",
      },
      id: "designation-sans-permis",
    },
    attendu: "absent",
    officiel: false,
    source: "Contre-epreuve du cas précédent : un avertissement qui ne s'éteint jamais n'avertit de rien",
  },
  {
    intitule:
      "Impossibilité de désigner fondée sur une cession du véhicule : l'article L. 121-6 ne l'admet pas comme cause d'exonération",
    mesure: {
      mesure: "avertissement",
      sousBranche: "b3-impossible",
      retouches: { evenement: "cession" },
      id: "evenement-n-exonere-pas-designation",
    },
    attendu: "present",
    officiel: false,
    source:
      "L'art. L. 121-6 du code de la route n'énumère que trois causes : vol, usurpation de plaque, tout autre événement de force majeure. La cession est une pièce du 1° c) de l'art. 529-10, pas une cause d'exonération de l'obligation de désigner",
  },
  {
    intitule:
      "La même branche fondée sur un vol : aucun avertissement, le texte le prévoit expressément",
    mesure: {
      mesure: "avertissement",
      sousBranche: "b3-impossible",
      retouches: { evenement: "vol" },
      id: "evenement-n-exonere-pas-designation",
    },
    attendu: "absent",
    officiel: false,
    source: "Contre-epreuve : le vol figure expressément à l'art. L. 121-6 du code de la route",
  },
  {
    intitule:
      "Aucun événement choisi : le courrier ne suppose rien et le signale au lieu d'imprimer un vol",
    mesure: {
      mesure: "avertissement",
      sousBranche: "a2-evenement",
      retouches: {},
      id: "evenement-non-precise",
    },
    attendu: "present",
    officiel: false,
    source:
      "Règle de production : aucune valeur par défaut du modèle de saisie ne constitue une qualification des faits",
  },
  {
    intitule:
      "Désigner le conducteur et contester la réalité de l'infraction ne peuvent pas figurer dans le même courrier",
    mesure: { mesure: "combinaison", a: "a1-conducteur", b: "a3-realite" },
    attendu: "interdite",
    officiel: false,
    source:
      "Le 1° et le 2° de l'art. 529-10 sont les deux termes d'une alternative ; c'est aussi la logique des cases du formulaire officiel",
  },
  {
    intitule:
      "Désigner un locataire et exposer un vol du véhicule restent, eux, compatibles",
    mesure: { mesure: "combinaison", a: "b1-locataire", b: "a2-evenement" },
    attendu: "autorisee",
    officiel: false,
    source:
      "Contre-epreuve : la table d'exclusions ne doit pas interdire tout ce qui n'est pas identique",
  },
  {
    intitule:
      "Champ de l'article 529-10 : les deux conditions sont CUMULATIVES (titulaire + liste de l'art. L. 121-3)",
    mesure: {
      mesure: "champ-529-10",
      destinataireEstTitulaire: true,
      infractionListeL121_3: false,
    },
    attendu: "hors-champ",
    officiel: false,
    source:
      "Le stationnement gênant, très gênant, dangereux ou abusif ne figure pas à l'art. R. 121-6 : ni consignation, ni recommandé, ni formulaire joint à peine d'irrecevabilité",
  },
  {
    intitule:
      "Le même avis pour une infraction de la liste de l'article L. 121-3 : le régime de l'article 529-10 s'applique",
    mesure: {
      mesure: "champ-529-10",
      destinataireEstTitulaire: true,
      infractionListeL121_3: true,
    },
    attendu: "dans-le-champ",
    officiel: false,
    source: "Deux conditions cumulatives réunies — art. 529-10, premier alinéa, CPP",
  },
  {
    intitule:
      "Stationnement, péages et dépôts de déchets : le transfert vers le locataire se fonde sur l'article L. 121-2",
    mesure: { mesure: "texte-transfert-locataire", nature: "stationnement-peage-dechets" },
    attendu: "art. L. 121-2, alinéa 2, du code de la route",
    officiel: false,
    source: "Art. L. 121-2, alinéa 2, du code de la route",
  },
  {
    intitule:
      "Contrôle automatique : le transfert vers le locataire se fonde sur l'article L. 121-3",
    mesure: { mesure: "texte-transfert-locataire", nature: "controle-automatique" },
    attendu: "art. L. 121-3, alinéa 4, du code de la route",
    officiel: false,
    source:
      "Art. L. 121-3, alinéa 4, du code de la route. Confondre les deux textes est l'erreur type du sujet",
  },
  {
    intitule:
      "Autre infraction : aucun texte ne transfère la redevabilité au locataire, et l'outil n'en invente pas",
    mesure: { mesure: "texte-transfert-locataire", nature: "autre" },
    attendu: "aucun",
    officiel: false,
    source:
      "Les art. L. 121-2 et L. 121-3 ont chacun leur liste : hors de ces listes, aucun transfert légal n'est prévu",
  },
];

/**
 * Rejoue un cas de controle AVEC LES VRAIES FONCTIONS. Aucun `default` : le
 * `jamais()` final ne compile que si toutes les mesures sont traitees. Un repli
 * silencieux aurait compare la bonne valeur attendue au mauvais calcul, et
 * l'autotest — qui est ici le garde-fou du build — aurait valide une divergence.
 */
export function evaluerCas(cas: CasDeControle): string {
  const m = cas.mesure;
  switch (m.mesure) {
    case "echeance": {
      const e = calculerEcheance(m.depart, m.delai);
      return e ? e.echeance : "illisible";
    }
    case "echeance-telepaiement": {
      const principal = calculerEcheance(m.depart, m.delaiPrincipal);
      if (!principal) return "illisible";
      // Quinze jours qui COMMENCENT a l'issue du delai principal : ce n'est pas
      // un delai unique de soixante jours, et il ne vaut que pour le paiement.
      const supplement = DELAIS["telepaiement-supplementaire"].valeur;
      return ajouterJours(principal.echeance, supplement) ?? "illisible";
    }
    case "montant-non-designation":
      return String(montantNonDesignation(m.stade, m.personne).montant);
    case "etiquette-non-designation":
      return montantNonDesignation(m.stade, m.personne).etiquette;
    case "consignation": {
      const c = montantConsignation(m.classe, m.stade);
      return c.calculable ? String(c.montant) : "non-calculable";
    }
    case "majoration-fps": {
      const r = calculerMajorationFps(m.restantDu);
      return r ? String(r.majoration) : "non-calculable";
    }
    case "mots-interdits": {
      const c = composerCourrier(saisieVide(m.sousBranche));
      if (!c) return "aucun-courrier";
      const trouves = motsInterditsTrouves(c);
      return trouves.length === 0 ? "aucun" : trouves.join(", ");
    }
    case "avertissement": {
      const s: Saisie = { ...saisieVide(m.sousBranche), ...m.retouches };
      return avertissements(s).some((a) => a.id === m.id) ? "present" : "absent";
    }
    case "combinaison":
      return combinaisonAutorisee(m.a, m.b).autorisee ? "autorisee" : "interdite";
    case "champ-529-10":
      return estDansLeChampDe529_10({
        destinataireEstTitulaire: m.destinataireEstTitulaire,
        infractionListeL121_3: m.infractionListeL121_3,
      })
        ? "dans-le-champ"
        : "hors-champ";
    case "texte-transfert-locataire": {
      const t = texteResponsabiliteLocataire(m.nature);
      return t ? t.article : "aucun";
    }
    default:
      return jamais(m, "Mesure de contrôle");
  }
}

/**
 * Controle d'integrite complet. Renvoie la liste des divergences, vide si tout
 * passe. Il fait cinq choses, dans cet ordre :
 *   1. coherence structurelle des deux tables de branches, qui disent la meme
 *      chose de deux facons ;
 *   2. verrous des points ouverts — le blocage est MECANIQUE, il ne repose pas
 *      sur la vigilance d'un relecteur ;
 *   3. integrite des sources et des delais ;
 *   4. controle de tous les specimens : variable non substituee, mention
 *      deontologique, piece imposee a peine d'irrecevabilite, mot d'un autre
 *      regime, et formulation valant aveu produite par le generateur lui-meme ;
 *   5. rejeu de CAS_DE_CONTROLE.
 */
export function verifierContestation(): string[] {
  const erreurs: string[] = [];

  // ── 1. Les deux tables de branches se recoupent ──
  const sousBranchesDeclarees = new Set<SousBranche>();
  for (const id of Object.keys(VOIES) as Voie[]) {
    const v = VOIES[id];
    if (v.id !== id) erreurs.push(`Voie « ${id} » : identifiant interne « ${v.id} » divergent`);
    if (v.sousBranches.length === 0) erreurs.push(`Voie « ${id} » : aucune sous-branche`);
    for (const sb of v.sousBranches) {
      if (sousBranchesDeclarees.has(sb))
        erreurs.push(`Sous-branche « ${sb} » rattachee à deux voies`);
      sousBranchesDeclarees.add(sb);
      if (VOIE_DE_SOUS_BRANCHE[sb] !== id)
        erreurs.push(
          `Sous-branche « ${sb} » : VOIES la rattache à « ${id} », VOIE_DE_SOUS_BRANCHE à « ${VOIE_DE_SOUS_BRANCHE[sb]} »`,
        );
      if (GABARITS[sb].voie !== id)
        erreurs.push(`Gabarit « ${sb} » : voie « ${GABARITS[sb].voie} » au lieu de « ${id} »`);
      if (GABARITS[sb].id !== sb) erreurs.push(`Gabarit « ${sb} » : identifiant interne divergent`);
    }
  }
  for (const sb of Object.keys(GABARITS) as SousBranche[]) {
    if (!sousBranchesDeclarees.has(sb))
      erreurs.push(`Sous-branche « ${sb} » : aucun gabarit ne la rattache à une voie`);
  }

  // ── 2. Verrous des points ouverts ──
  const ouvert = (id: string): boolean => POINTS_A_LEVER.some((p) => p.id === id);
  if (ouvert(IMPUTATION_CONSIGNATION.pointALever) && IMPUTATION_CONSIGNATION.publie) {
    erreurs.push(
      "imputation-consignation : IMPUTATION_CONSIGNATION.publie est passé à true alors que le point n'est pas levé. Aucun montant net ne peut être affiché tant qu'aucun texte ne prévoit l'imputation de la consignation sur l'amende prononcée.",
    );
  }
  if (
    ouvert(BRANCHE_DELIT_NON_DESIGNATION.pointALever) &&
    BRANCHE_DELIT_NON_DESIGNATION.montants !== null
  ) {
    erreurs.push(
      "branche-delit-verrouillee : BRANCHE_DELIT_NON_DESIGNATION.montants n'est plus nul alors que le verbatim de l'art. R. 48-1, II, 7°, n'a pas été recopié à la source.",
    );
  }
  // Le libelle des montants de non-designation ne doit jamais nommer une
  // infraction-source : 675 € en face d'un exces de vitesse est la faute qui
  // disqualifie toutes les pages du sujet.
  for (const personne of ["physique", "morale"] as const) {
    for (const stade of ["minoree", "forfaitaire", "majoree", "maximum-tribunal"] as const) {
      const m = montantNonDesignation(stade, personne);
      if (m.etiquette !== ETIQUETTE_NON_DESIGNATION)
        erreurs.push(`Barème de non-designation (${stade}, ${personne}) : etiquette perdue`);
      const l = normaliserTexte(m.libelle);
      if (!l.includes("non-designation"))
        erreurs.push(
          `Barème de non-designation (${stade}, ${personne}) : le libellé ne nomme plus la non-designation`,
        );
      for (const interdit of ["vitesse", "feu rouge", "radar"]) {
        if (l.includes(interdit))
          erreurs.push(
            `Barème de non-designation (${stade}, ${personne}) : le libellé nomme « ${interdit} », alors que ce montant est le prix de l'oubli de désignation`,
          );
      }
    }
  }

  // ── 3. Sources et delais ──
  const urls = new Set<string>();
  for (const s of META.sources) {
    if (!s.url.startsWith("https://")) erreurs.push(`Source non securisee : ${s.url}`);
    if (urls.has(s.url)) erreurs.push(`Source citee deux fois : ${s.url}`);
    urls.add(s.url);
    if (!s.nom.trim()) erreurs.push(`Source sans intitule : ${s.url}`);
  }
  for (const id of Object.keys(DELAIS) as DelaiId[]) {
    const d = DELAIS[id];
    if (d.id !== id) erreurs.push(`Délai « ${id} » : identifiant interne divergent`);
    if (!(d.valeur > 0)) erreurs.push(`Délai « ${id} » : valeur non strictement positive`);
    if (!d.source.url.startsWith("https://")) erreurs.push(`Délai « ${id} » : source non resolvable`);
    // Aucun point de depart ne doit parler de RECEPTION : ce mot n'a aucun effet
    // juridique ici et son apparition dans un libelle ferait compter le delai a
    // partir de la mauvaise date. La seule exception est l'opposition, dont le
    // texte vise expressement l'avis de reception.
    if (id !== "opposition" && normaliserTexte(d.pointDeDepart).includes("réception du courrier"))
      erreurs.push(`Délai « ${id} » : le point de départ parle de réception`);
  }
  if (!VOIES.rapo.motsInterdits.includes("consignation"))
    erreurs.push(
      "Branche « rapo » : le mot « consignation » a disparu de la liste des mots interdits, alors qu'un forfait de post-stationnement n'en connaît pas",
    );

  // ── 4. Specimens ──
  for (const { gabarit, courrier } of specimens()) {
    const texte = courrierEnTexte(courrier);
    const n = normaliserTexte(texte);
    if (texte.includes("{{") || texte.includes("}}"))
      erreurs.push(`Spécimen « ${gabarit.id} » : variable non substituee dans le document`);
    if (texte.includes("undefined") || texte.includes("NaN") || texte.includes("Invalid Date"))
      erreurs.push(`Spécimen « ${gabarit.id} » : valeur technique imprimee dans le document`);
    if (!texte.includes(MENTION_DEONTOLOGIQUE))
      erreurs.push(`Spécimen « ${gabarit.id} » : mention deontologique absente du pied de page`);
    if (!courrier.objet.trim())
      erreurs.push(`Spécimen « ${gabarit.id} » : objet vide`);
    if (!courrier.formule.trim())
      erreurs.push(`Spécimen « ${gabarit.id} » : formule de politesse absente`);
    // Le generateur ne doit JAMAIS produire lui-meme une formulation qu'il
    // reproche a l'utilisateur.
    for (const f of FORMULATIONS_INTERDITES) {
      if (n.includes(normaliserTexte(f.expression)))
        erreurs.push(
          `Spécimen « ${gabarit.id} » : le gabarit produit la formulation interdite « ${f.expression} »`,
        );
    }
    const interdits = motsInterditsTrouves(courrier);
    if (interdits.length > 0)
      erreurs.push(
        `Spécimen « ${gabarit.id} » : mot d'un autre régime dans le document — ${interdits.join(", ")}`,
      );
    // Les pieces imposees a peine d'irrecevabilite sont en tete et non
    // supprimables : on verifie qu'elles y sont reellement.
    const obligatoires = VOIES[gabarit.voie].piecesObligatoires(saisieVide(gabarit.id));
    for (const p of obligatoires) {
      if (!courrier.pieces.includes(p))
        erreurs.push(`Spécimen « ${gabarit.id} » : pièce obligatoire absente — ${p}`);
    }
    // Les pieces exigees a peine d'irrecevabilite sont verifiees SUR LA LISTE
    // ASSEMBLEE, et pas seulement contre la declaration de la voie : un test de
    // mutation a montre qu'une `piecesObligatoires` videe passait au travers du
    // controle precedent, qui se contentait de parcourir cette declaration.
    // Ici, c'est le document reellement produit qui doit porter la piece.
    const doitPorter: ReadonlyArray<{ fragment: string; texte: string }> =
      gabarit.voie === "reclamation"
        ? [
            {
              fragment: "avis d'amende forfaitaire majorée",
              texte:
                "l'avis d'amende forfaitaire majorée, exige à peine d'irrecevabilité par l'alinéa 3 de l'art. 530 du code de procédure pénale",
            },
          ]
        : gabarit.voie === "rapo"
          ? [
              {
                fragment: "avis de paiement",
                texte:
                  "la copie de l'avis de paiement contesté, exigée à peine d'irrecevabilité par l'art. R. 2333-120-13 du CGCT",
              },
              {
                fragment: "certificat d'immatriculation",
                texte:
                  "la copie du certificat d'immatriculation, exigée à peine d'irrecevabilité par l'art. R. 2333-120-13 du CGCT",
              },
            ]
          : [];
    // Les DEUX cotes sont normalises. Ne normaliser que la piece rendait le
    // controle dependant de l'accentuation du fragment attendu : accentuer la
    // prose du module faisait alors echouer un test qui ne portait pas sur elle.
    for (const d of doitPorter) {
      const attendu = normaliserTexte(d.fragment);
      if (!courrier.pieces.some((p) => normaliserTexte(p).includes(attendu)))
        erreurs.push(
          `Spécimen « ${gabarit.id} » : la liste des pièces jointes ne porte pas ${d.texte}`,
        );
    }
  }

  // ── 5. Rejeu des cas de controle ──
  for (const cas of CAS_DE_CONTROLE) {
    const obtenu = evaluerCas(cas);
    if (obtenu !== cas.attendu)
      erreurs.push(`${cas.intitule} : attendu « ${cas.attendu} », obtenu « ${obtenu} »`);
  }

  return erreurs;
}

// PAS D'AUTOTEST AU NIVEAU MODULE.
//
// Ce fichier portait ici un `if (typeof window === "undefined") { … }` qui
// rejouait `verifierContestation()` a l'import. Deux raisons de l'avoir retire.
//
// 1. Il etait REDONDANT : la page appelle deja `verifierContestation()` dans son
//    corps, elle est `force-static`, elle est donc evaluee pendant `next build`,
//    et une divergence y fait echouer la mise en ligne exactement de la meme
//    facon. Le garde-fou n'est pas affaibli, il est simplement appele une fois.
//
// 2. Il PESAIT SUR LE BUNDLE CLIENT. `package.json` ne declare pas
//    `sideEffects: false` et aucun bundler ne constant-folde `typeof window` :
//    la reference retenait `verifierContestation`, et par transitivite
//    `CAS_DE_CONTROLE`, `evaluerCas`, `specimens()` et `GABARITS_GENERES`, dans
//    un module importe par un composant `"use client"`. Une vingtaine de
//    kilo-octets de source pour du code que le navigateur n'executera jamais.
