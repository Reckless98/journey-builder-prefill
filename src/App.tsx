import type { BlueprintRequest } from './api/blueprintClient';
import { BlueprintWorkspace } from './components/BlueprintWorkspace';
import { Button } from './components/Button';
import { StatusPanel } from './components/StatusPanel';
import { blueprintRequest } from './config';
import { useBlueprint } from './hooks/useBlueprint';
import { defaultPrefillProviders } from './prefill-sources/registry';
import type { PrefillSourceProvider } from './prefill-sources/types';

interface AppProps {
  /** Which blueprint to load. Defaults to the one configured through the environment. */
  request?: BlueprintRequest;
  /** The prefill sources to offer. Defaults to the registry. */
  providers?: readonly PrefillSourceProvider[];
}

export function App({ request = blueprintRequest, providers = defaultPrefillProviders }: AppProps) {
  const { state, retry } = useBlueprint(request);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="text-2xl font-semibold tracking-tight">Journey Builder</h1>
          <p className="mt-1 text-sm text-slate-600">
            Choose where each form field gets its starting value: a form earlier in the journey, or
            global data.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {state.status === 'loading' && (
          <StatusPanel role="status" busy title="Loading blueprint…" />
        )}
        {state.status === 'error' && (
          <StatusPanel
            role="alert"
            title="The blueprint could not be loaded"
            action={
              <Button variant="primary" onClick={retry}>
                Try again
              </Button>
            }
          >
            {state.message}
          </StatusPanel>
        )}
        {state.status === 'ready' && (
          <BlueprintWorkspace blueprint={state.blueprint} providers={providers} />
        )}
      </main>
    </div>
  );
}
