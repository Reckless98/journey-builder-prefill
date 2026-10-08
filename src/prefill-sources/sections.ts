import { getDirectDependencies, getTransitiveDependencies } from '../domain/graph';
import { FORM_FIELD_SOURCE, formFieldSource, sourceId } from '../domain/mappings';
import type {
  PrefillContext,
  PrefillOption,
  PrefillOptionGroup,
  PrefillSourceProvider,
} from './types';

/** What one provider offers for one form. This is all the UI knows about a provider. */
export interface PrefillSection {
  providerId: string;
  label: string;
  /** Never contains a group without options. May itself be empty. */
  groups: readonly PrefillOptionGroup[];
}

/** An option together with the group it was found in, for describing a stored mapping. */
export interface ResolvedOption {
  groupLabel: string;
  option: PrefillOption;
}

/**
 * Asks every provider what it offers for `context.form`: one section per provider, in order.
 *
 * Two rules hold for the result whatever the providers return, and the picker and
 * `indexOptions` rely on both:
 * - a form field is only offered while it exists upstream of the form,
 * - a source is offered once, by the first provider that returns it.
 */
export function buildSections(
  providers: readonly PrefillSourceProvider[],
  context: PrefillContext,
): PrefillSection[] {
  const upstreamFields = upstreamFieldSourceIds(context);
  const offered = new Set<string>();
  const accept = (option: PrefillOption) => {
    const id = sourceId(option.source);
    if (option.source.type === FORM_FIELD_SOURCE && !upstreamFields.has(id)) return false;
    if (offered.has(id)) return false;
    offered.add(id);
    return true;
  };

  return providers.map((provider) => ({
    providerId: provider.id,
    label: provider.label,
    groups: keepOptions(provider.getGroups(context), accept),
  }));
}

/** Source ids of every field of every form upstream of `context.form`. */
function upstreamFieldSourceIds({ blueprint, form }: PrefillContext): Set<string> {
  const upstream = new Set([
    ...getDirectDependencies(blueprint.dependencies, form.id),
    ...getTransitiveDependencies(blueprint.dependencies, form.id),
  ]);
  return new Set(
    blueprint.forms
      .filter((candidate) => upstream.has(candidate.id))
      .flatMap((candidate) =>
        candidate.fields.map((field) => sourceId(formFieldSource(candidate.id, field.key))),
      ),
  );
}

/** Keeps the options that pass `keep` and drops the groups left without any. */
function keepOptions(
  groups: readonly PrefillOptionGroup[],
  keep: (option: PrefillOption, group: PrefillOptionGroup) => boolean,
): PrefillOptionGroup[] {
  return groups
    .map((group) => ({ ...group, options: group.options.filter((option) => keep(option, group)) }))
    .filter((group) => group.options.length > 0);
}

/**
 * Source id → option, for every option on offer.
 *
 * A stored mapping is valid for a form exactly when its source is in this index. Lookup is by
 * source identity, never by label, so a mapping whose source is no longer on offer resolves to
 * nothing.
 */
export function indexOptions(sections: readonly PrefillSection[]): Map<string, ResolvedOption> {
  const index = new Map<string, ResolvedOption>();
  for (const section of sections) {
    for (const group of section.groups) {
      for (const option of group.options) {
        index.set(sourceId(option.source), { groupLabel: group.label, option });
      }
    }
  }
  return index;
}

/**
 * Narrows sections to the options matching a search. Every whitespace-separated term must
 * appear in the group label, option label or source key, ignoring case. Sections are kept
 * even when nothing in them matches.
 */
export function filterSections(
  sections: readonly PrefillSection[],
  query: string,
): readonly PrefillSection[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return sections;

  const matches = (option: PrefillOption, group: PrefillOptionGroup) => {
    const haystack = `${group.label} ${option.label} ${option.source.key}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  };

  return sections.map((section) => ({
    ...section,
    groups: keepOptions(section.groups, matches),
  }));
}
