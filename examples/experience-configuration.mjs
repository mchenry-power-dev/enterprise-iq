import { sha256 } from './sha256.mjs';

/** Presentation configuration only. Access below is a trusted SYNTHETIC input, not authentication. */
const MODULES = ['home', 'reports', 'data-explorer', 'knowledge', 'ask-iq', 'my-workspace'];
const ACTIONS = ['expand', 'save', 'export', 'chart', 'ask-iq', 'native-open'];
const PANELS = ['definitions', 'documentation', 'freshness', 'ask-iq'];
const identifier = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
const label = value => typeof value === 'string' && value.length > 0 && value.length <= 80 &&
  !/[<>\u0000-\u001f\u007f]/.test(value) && value.trim() === value;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exactKeys = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));
const uniqueList = (value, check, maximum = 30) => Array.isArray(value) && value.length <= maximum &&
  Array.from(value).every(check) && new Set(value).size === value.length;

/** Only a local application route: no executable schemes, remote URLs, queries or fragments. */
const safeRoute = value => value === null || (typeof value === 'string' &&
  /^\/[a-z0-9]+(?:[/-][a-z0-9]+)*$/.test(value));
const schema = {
  brandName: label,
  helpRoute: safeRoute,
  themeAccent: value => ['navy', 'teal', 'plum'].includes(value),
  themeDensity: value => ['comfortable', 'compact'].includes(value),
  navigation: value => Array.isArray(value) && value.length > 0 && value.length <= MODULES.length &&
    Array.from(value).every(item => exactKeys(item, ['module', 'label']) && MODULES.includes(item.module) && label(item.label)) &&
    new Set(value.map(item => item.module)).size === value.length,
  landingPage: value => MODULES.includes(value),
  defaultReport: value => value === null || identifier(value),
  collectionResourceIds: value => uniqueList(value, identifier),
  contextualDocumentIds: value => uniqueList(value, identifier),
  reportPanels: value => uniqueList(value, item => PANELS.includes(item), PANELS.length),
  approvedActions: value => uniqueList(value, item => ACTIONS.includes(item), ACTIONS.length),
  savedViewDefault: value => ['source-default', 'summary', 'detail'].includes(value),
  dataExplorerEnabled: value => typeof value === 'boolean',
  favorites: value => uniqueList(value, identifier),
  layout: value => ['report-first', 'balanced'].includes(value),
};
const SETTINGS = Object.keys(schema);

function validateLayer(layer, name, errors) {
  const fields = name === 'individual' ? ['version', 'settings'] : ['version', 'settings', 'locks'];
  if (!exactKeys(layer, fields) || !identifier(layer.version) || !plain(layer.settings)) {
    errors.push({ code: 'invalid_layer', path: name });
    return;
  }
  if (!exactKeys(layer.settings, SETTINGS)) errors.push({ code: 'unknown_setting', path: `${name}.settings` });
  for (const key of SETTINGS) {
    if (Object.hasOwn(layer.settings, key)) {
      if (!schema[key](layer.settings[key])) errors.push({ code: 'invalid_value', path: `${name}.settings.${key}` });
    } else if (name === 'organization') {
      errors.push({ code: 'required_setting', path: `organization.settings.${key}` });
    }
  }
  if (name !== 'individual' && (!uniqueList(layer.locks, key => SETTINGS.includes(key), SETTINGS.length) ||
      layer.locks.some(key => !Object.hasOwn(layer.settings, key)))) {
    errors.push({ code: 'invalid_locks', path: `${name}.locks` });
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (plain(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

/**
 * Arrays are atomic settings. Earlier locks win; otherwise organization < team < individual.
 * No arbitrary code, CSS, HTML, SQL, authorization options or administrative modules are accepted.
 * Resource visibility is projected afresh from supplied access; consumers still authorize every action.
 */
export function resolveExperience(input) {
  const errors = [];
  if (!exactKeys(input, ['organization', 'team', 'individual', 'access'])) {
    return { status: 'invalid', errors: [{ code: 'invalid_input', path: 'input' }] };
  }
  for (const name of ['organization', 'team', 'individual']) validateLayer(input[name], name, errors);
  const access = input.access;
  if (!exactKeys(access, ['moduleIds', 'actionIds', 'reportIds', 'documentIds']) ||
      !uniqueList(access.moduleIds, item => MODULES.includes(item), MODULES.length) ||
      !uniqueList(access.actionIds, item => ACTIONS.includes(item), ACTIONS.length) ||
      !uniqueList(access.reportIds, identifier) || !uniqueList(access.documentIds, identifier)) {
    errors.push({ code: 'invalid_access_context', path: 'access' });
  }
  if (errors.length > 0) return { status: 'invalid', errors };

  const effective = {};
  const provenance = {};
  const locks = new Map();
  const conflicts = [];
  for (const name of ['organization', 'team', 'individual']) {
    const layer = input[name];
    for (const key of SETTINGS) {
      if (!Object.hasOwn(layer.settings, key)) continue;
      if (locks.has(key)) {
        if (canonical(layer.settings[key]) !== canonical(effective[key])) {
          conflicts.push({ setting: key, attemptedBy: name, retainedFrom: provenance[key].source, reason: 'locked' });
        }
        continue;
      }
      effective[key] = structuredClone(layer.settings[key]);
      provenance[key] = { source: name, version: layer.version };
    }
    for (const key of layer.locks ?? []) {
      if (!locks.has(key)) {
        locks.set(key, name);
        provenance[key].lockedBy = name;
      }
    }
  }

  // These restrictions cannot be relaxed by a preference, even a locked organization preference.
  const restrict = (key, next, reason = 'access') => {
    if (canonical(effective[key]) !== canonical(next)) {
      effective[key] = next;
      provenance[key].restrictedBy = reason;
    }
  };
  restrict('dataExplorerEnabled', effective.dataExplorerEnabled && access.moduleIds.includes('data-explorer'));
  restrict('navigation', effective.navigation.filter(item => access.moduleIds.includes(item.module) &&
    (item.module !== 'data-explorer' || effective.dataExplorerEnabled === true)));
  restrict('approvedActions', effective.approvedActions.filter(action => access.actionIds.includes(action) &&
    (action !== 'ask-iq' || access.moduleIds.includes('ask-iq'))));
  restrict('reportPanels', effective.reportPanels.filter(panel => panel !== 'ask-iq' || access.moduleIds.includes('ask-iq')));
  restrict('defaultReport', access.reportIds.includes(effective.defaultReport) ? effective.defaultReport : null);
  restrict('collectionResourceIds', effective.collectionResourceIds.filter(id => access.reportIds.includes(id)));
  restrict('contextualDocumentIds', effective.contextualDocumentIds.filter(id => access.documentIds.includes(id)));
  restrict('favorites', effective.favorites.filter(id => access.reportIds.includes(id) || access.documentIds.includes(id)));
  if (!effective.navigation.some(item => item.module === effective.landingPage)) {
    restrict('landingPage', effective.navigation[0]?.module ?? null, 'available_navigation');
  }

  const versions = Object.fromEntries(['organization', 'team', 'individual'].map(name => [name, input[name].version]));
  const digest = sha256(canonical({ schema: 1, versions, effective, provenance })).slice(0, 16);
  return { status: 'resolved', experience_config_version: `exp-v1-${digest}`, effective, provenance, conflicts };
}
