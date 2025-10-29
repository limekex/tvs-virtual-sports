// Debug utilities for TVS app
export const DEBUG =
  new URLSearchParams(location.search).get("tvsdebug") === "1" ||
  window.TVS_DEBUG === true ||
  localStorage.getItem("tvsDev") === "1";

export function log(...args) {
  if (DEBUG) console.debug("[TVS]", ...args);
}

export function err(...args) {
  console.error("[TVS]", ...args);
}
