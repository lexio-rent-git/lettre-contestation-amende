# Lettres de contestation d'amende en ligne de commande.
# Aucune dépendance npm : Node 24 exécute le TypeScript directement.
FROM node:24-alpine

LABEL org.opencontainers.image.title="lettre-contestation-amende" \
      org.opencontainers.image.description="Lettres de contestation d'amende et de désignation du conducteur, délais et garde-fous de rédaction (procédure pénale française)" \
      org.opencontainers.image.url="https://lexio.rent/logiciel-location-voiture" \
      org.opencontainers.image.source="https://github.com/lexio-rent-git/lettre-contestation-amende" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="Lexio Rent"

WORKDIR /app
COPY package.json README.md ./
COPY LICENSE* ./
COPY src ./src
COPY tests ./tests

# Les tests et les contrôles internes sont rejoués au build : une image dont
# un cas de contrôle diverge n'est jamais produite.
RUN node --test tests/ && node src/cli.ts verifier

USER node
ENTRYPOINT ["node", "/app/src/cli.ts"]
CMD ["--help"]
