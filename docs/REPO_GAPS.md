# Hermes Dashboard Repo Gaps

Denne note sammenligner dashboard-repoet med et mere fuldt udstyret GitHub-repo.

## Scope

Denne rapport er begrænset til repo- og GitHub-relaterede artefakter. Den ændrer ikke Hermes runtime, gateway, agentprocesser eller serverkonfiguration.

## Hvad dashboardet allerede har

- En git-repo root i [dashboard](../).
- En minimal CI-workflow i [.github/workflows/ci.yml](../.github/workflows/ci.yml).
- En docs-struktur i [docs/](.).
- En [.env.example](../.env.example) til frontend-proxy-konfiguration.
- En PR-template i [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md).
- Issue templates i [.github/ISSUE_TEMPLATE/](../.github/ISSUE_TEMPLATE/).
- CODEOWNERS i [.github/CODEOWNERS](../.github/CODEOWNERS).
- Dependabot i [.github/dependabot.yml](../.github/dependabot.yml).
- PR labeler i [.github/labeler.yml](../.github/labeler.yml).
- Stale automation i [.github/stale.yml](../.github/stale.yml).

## Hvad der stadig mangler

- En fuld lint/test dependency-stack, hvis vi vil have egentlig ESLint-drevet validering af JSX/React-filer.
- Mere opdateret side-dokumentation, hvis nye routes kommer til senere.
- Eventuel branch protection og required checks på GitHub-niveau, hvis repoet skal håndhæves stramt.

## Hvad vi bevidst bør undgå

- Ingen ændringer i Hermes runtime, gateway eller agentprocesser bare for at gøre dashboardet mere repo-komplet.
- Ingen automation, der starter eller stopper services som en sideeffekt af CI eller repo-dokumentation.
- Ingen scripts, der skriver til shared state under `~/.hermes/` uden tydelig ownership.

## Prioriteret næste skridt

1. Hold docs i sync med sider og routes.
2. Brug release workflow og commit-konventioner konsekvent.
3. Tilføj ESLint/Prettier, hvis dashboardet får mere frontend-aktiv udvikling.
