import { sourceId } from '../domain/mappings';
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
 * Asks every provider what it offers for `context.form`. One section per provider, in order.
 *
 * Each source is offered once: when two providers return the same source, the earlier one
 * keeps it. Source ids are therefore unique across all sections, which the picker and
 * `indexOptions` rely on.
 */
export function buildSections(
  providers: readonly PrefillSourceProvider[],
  context: PrefillContext,
): PrefillSection[] {
  const offered = new Set<string>();
  const isFirstOffer = (option: PrefillOption) => {
    const id = sourceId(option.source);
    if (offered.has(id)) return false;
    offered.add(id);
    return true;
  };

  return providers.map((provider) => ({
    providerId: provider.id,
    label: provider.label,
    groups: provider
      .getGroups(context)
      .map((group) => ({ ...group, options: group.options.filter(isFirstOffer) }))
      .filter((group) => group.options.length > 0),
  }));
}

/**
 * Source id → option, for every option on offer.
 *
 * A stored mapping is valid for a form exactly when its source is in this index. Lookup is by
 * source identity, never by label, so "Email" of one form cannot stand in for "Email" of another
 * and a mapping whose source is no longer upstream resolves to nothing.
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
 * appear somewhere in the group label, option label or source key, ignoring case, so
 * "client email" finds the contact email of the client organization. Sections are kept even
 * when nothing in them matches.
 */
export function filterSections(
  sections: readonly PrefillSection[],
  query: string,
): readonly PrefillSection[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return sections;

  const matches = (group: PrefillOptionGroup, option: PrefillOption) => {
    const haystack = `${group.label} ${option.label} ${option.source.key}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  };

  return sections.map((section) => ({
    ...section,
    groups: section.groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => matches(group, option)),
      }))
      .filter((group) => group.options.length > 0),
  }));
}
