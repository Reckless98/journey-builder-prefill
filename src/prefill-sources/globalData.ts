import type { PrefillSource } from '../domain/types';
import type { PrefillSourceProvider } from './types';

/** Source `type` for a property of a global object, which is available to every form. */
const GLOBAL_SOURCE = 'global';

export interface GlobalDataSet {
  /** Becomes the `ownerId` of the sources, so it must be unique among data sets. */
  id: string;
  label: string;
  properties: readonly { key: string; label: string; valueType?: string }[];
}

export function globalSource(dataSetId: string, propertyKey: string): PrefillSource {
  return { type: GLOBAL_SOURCE, ownerId: dataSetId, key: propertyKey };
}

/**
 * Example global data. The assignment leaves the content of global data open and the graph
 * endpoint does not describe any, so these two sets are static and exist to show a provider
 * that has nothing to do with the form graph.
 */
const EXAMPLE_GLOBAL_DATA: readonly GlobalDataSet[] = [
  {
    id: 'action',
    label: 'Action Properties',
    properties: [
      { key: 'id', label: 'Action ID', valueType: 'short-text' },
      { key: 'name', label: 'Action name', valueType: 'short-text' },
      { key: 'status', label: 'Status', valueType: 'short-text' },
      { key: 'created_at', label: 'Created at', valueType: 'date-time' },
    ],
  },
  {
    id: 'client_organization',
    label: 'Client Organization Properties',
    properties: [
      { key: 'id', label: 'Organization ID', valueType: 'short-text' },
      { key: 'name', label: 'Organization name', valueType: 'short-text' },
      { key: 'email', label: 'Contact email', valueType: 'short-text' },
      { key: 'country', label: 'Country', valueType: 'short-text' },
    ],
  },
];

/** A provider that offers the properties of the given data sets to every form. */
export function createGlobalDataProvider(
  dataSets: readonly GlobalDataSet[] = EXAMPLE_GLOBAL_DATA,
): PrefillSourceProvider {
  return {
    id: 'global-data',
    label: 'Global data',
    getGroups: () =>
      dataSets.map((dataSet) => ({
        id: dataSet.id,
        label: dataSet.label,
        options: dataSet.properties.map((property) => ({
          source: globalSource(dataSet.id, property.key),
          label: property.label,
          valueType: property.valueType,
        })),
      })),
  };
}

export const globalDataProvider = createGlobalDataProvider();
