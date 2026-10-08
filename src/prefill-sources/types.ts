import type { Blueprint, FormNode, PrefillSource } from '../domain/types';

/** What a provider is told about the form being configured. */
export interface PrefillContext {
  blueprint: Blueprint;
  /** The form whose fields are being prefilled. */
  form: FormNode;
}

/** One value a field can be prefilled from. */
export interface PrefillOption {
  /** What gets stored in the mapping. Its id (`sourceId`) is the option's identity. */
  source: PrefillSource;
  label: string;
  /**
   * The kind of value, e.g. "short-text". Shown as a hint. Nothing filters on it: the
   * assignment defines no compatibility rules between field types.
   */
  valueType?: string;
}

/** A named set of options that belong together: the fields of one form, one global object, … */
export interface PrefillOptionGroup {
  /** Unique within its provider. */
  id: string;
  label: string;
  options: readonly PrefillOption[];
}

/**
 * A source of prefill options.
 *
 * This is the whole extension point: the editor and the picker only ever see the groups and
 * options providers return, so a new kind of source is a new object of this shape added to the
 * list in `registry.ts`.
 */
export interface PrefillSourceProvider {
  /** Unique among the providers in use. */
  id: string;
  /** Heading of this provider's section in the source picker. */
  label: string;
  /**
   * The options available for the fields of `context.form`, as zero or more groups. Must be a
   * pure function of the context: it is called during render.
   */
  getGroups(context: PrefillContext): PrefillOptionGroup[];
}
