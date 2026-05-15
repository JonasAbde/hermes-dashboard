import { PagePrimer } from '../components/ui/PagePrimer'
import OperationsForgeTab from '../components/operations/OperationsForgeTab'

export default function ForgePage() {
  return (
    <div className="space-y-4 max-w-6xl">
      <PagePrimer
        title="Hermes Forge"
        body="Katalog, profiler og marketplace shell for Agent Packs. Her starter discovery-laget oven på registry, livscyklus og verification."
        tip="Brug katalog-toggle for public browsing på tværs af workspaces. Kræver kørende dashboard-API (port 5174)."
      />
      <OperationsForgeTab hideTopHeader defaultCatalog />
    </div>
  )
}
