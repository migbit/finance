// Run after Chart.js and before the page modules create their charts.
// Canvas colors must be resolved values; CSS variables cannot be used directly.
(() => {
  if (document.body?.dataset.theme !== 'dark' || !globalThis.Chart) return;
  const style = getComputedStyle(document.body);
  const color = name => style.getPropertyValue(name).trim();
  Chart.defaults.color = color('--text-dim');
  Chart.defaults.borderColor = color('--border');
  Chart.defaults.plugins.tooltip.backgroundColor = color('--surface-raised');
  Chart.defaults.plugins.tooltip.titleColor = color('--text');
  Chart.defaults.plugins.tooltip.bodyColor = color('--text');
})();
