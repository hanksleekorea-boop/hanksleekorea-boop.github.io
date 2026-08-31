export const LIFEPANEL_STORAGE_PREFIX = "lifepanel.";
export const LIFEPANEL_LAST_EXPORT_KEY = "lifepanel.alpha.last-export.v1";
export const LIFEPANEL_REFLECTIONS_KEY = "lifepanel.alpha.reflections.v1";
export const LIFEPANEL_SCENARIO_KEY = "lifepanel.alpha.scenario.v1";

function requireStorage(storage) {
  if (!storage || typeof storage.key !== "function" || typeof storage.removeItem !== "function" || !Number.isInteger(storage.length)) {
    throw new TypeError("storage must provide length, key, and removeItem");
  }
  return storage;
}

export function listLifePanelStorageKeys(storage) {
  const target = requireStorage(storage);
  const keys = [];
  for (let index = 0; index < target.length; index += 1) {
    const key = target.key(index);
    if (typeof key === "string" && key.startsWith(LIFEPANEL_STORAGE_PREFIX)) keys.push(key);
  }
  return Object.freeze(keys.sort());
}

export function clearLifePanelLocalData(storage) {
  const target = requireStorage(storage);
  const keys = listLifePanelStorageKeys(target);
  for (const key of keys) target.removeItem(key);
  return Object.freeze({ removed: keys.length, keys, preservedLegacyKey: "wedoit.app.v6" });
}
