// Point d'entrée du répertoire de tests.
//
// Sur Node v24, `node --test tests/` ne développe pas un argument répertoire en
// liste de fichiers : le lanceur exécute « tests » comme un module d'entrée, que
// la résolution CJS ramène à ce fichier index.js. Il suffit donc d'importer ici
// chaque fichier de tests : les tests s'enregistrent auprès de node:test et sont
// rejoués normalement. `node --test tests/contestation.test.ts` et
// `node --test "tests/*.test.ts"` restent également utilisables.
import "./contestation.test.ts";
import "./cli.test.ts";
