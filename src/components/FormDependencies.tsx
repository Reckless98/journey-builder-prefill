import { getDirectDependencies, getTransitiveDependencies } from '../domain/graph';
import type { Blueprint, FormNode } from '../domain/types';

interface FormDependenciesProps {
  blueprint: Blueprint;
  form: FormNode;
}

/** Where a form sits in the graph: the forms it depends on directly, and through those. */
export function FormDependencies({ blueprint, form }: FormDependenciesProps) {
  const formsAmong = (nodeIds: string[]) =>
    blueprint.forms.filter((candidate) => nodeIds.includes(candidate.id));

  const direct = formsAmong(getDirectDependencies(blueprint.dependencies, form.id));
  const transitive = formsAmong(getTransitiveDependencies(blueprint.dependencies, form.id));

  if (direct.length === 0 && transitive.length === 0) {
    return <p className="text-sm text-slate-600">Does not depend on any other form.</p>;
  }

  return (
    <dl className="flex flex-col gap-1.5 text-sm">
      <DependencyRow term="Depends directly on" forms={direct} />
      <DependencyRow term="Depends indirectly on" forms={transitive} />
    </dl>
  );
}

function DependencyRow({ term, forms }: { term: string; forms: readonly FormNode[] }) {
  if (forms.length === 0) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <dt className="text-slate-600">{term}</dt>
      <dd className="flex flex-wrap gap-1.5">
        {forms.map((form) => (
          <span
            key={form.id}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
          >
            {form.name}
          </span>
        ))}
      </dd>
    </div>
  );
}
