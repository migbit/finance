const reduceMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') || { matches: false };
let chartEnvironmentReady = false;

const centerTextPlugin = {
  id: 'centerText',
  afterDraw(chart, args, opts) {
    const { ctx, chartArea } = chart;
    if (!ctx || !chartArea) return;
    const text = opts?.text;
    if (!text) return;
    ctx.save();
    ctx.fillStyle = opts.color || '#0f172a';
    ctx.font = opts.font || '600 14px Montserrat, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = (chartArea.left + chartArea.right) / 2;
    const y = (chartArea.top + chartArea.bottom) / 2;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
};

function ensureChartEnvironment() {
  const Chart = window.Chart;
  if (!Chart) {
    console.warn('[analisev2] Chart.js is not available on window.');
    return null;
  }
  if (chartEnvironmentReady) return Chart;

  try {
    Chart.register(centerTextPlugin);
    if (typeof window.ChartDataLabels !== 'undefined') {
      Chart.register(window.ChartDataLabels);
    }
  } catch (err) {
    console.warn('[analisev2] Failed to register Chart plugins', err);
  }

  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.color = '#0f172a';
  Chart.defaults.font.family = 'Montserrat, system-ui, sans-serif';
  Chart.defaults.font.weight = '500';
  Chart.defaults.plugins.legend.labels.usePointStyle = false;
  Chart.defaults.plugins.legend.labels.font = {
    family: 'Montserrat, system-ui, sans-serif',
    size: 12
  };
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
  Chart.defaults.plugins.tooltip.titleFont = {
    family: 'Montserrat, system-ui, sans-serif',
    weight: '600',
    size: 12
  };
  Chart.defaults.plugins.tooltip.bodyFont = {
    family: 'Montserrat, system-ui, sans-serif',
    size: 12
  };

  if (reduceMotionQuery.matches) {
    Chart.defaults.animation = false;
    Chart.defaults.animations = false;
  }

  chartEnvironmentReady = true;
  return Chart;
}

function resolveCanvas(target) {
  if (!target) return null;
  if (typeof target === 'string') {
    return document.getElementById(target);
  }
  if (target instanceof HTMLCanvasElement) return target;
  if (target?.canvas instanceof HTMLCanvasElement) return target.canvas;
  return null;
}

function isObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function deepMerge(target, source) {
  if (!isObject(target) || !isObject(source)) return target;
  Object.keys(source).forEach((key) => {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (Array.isArray(srcVal)) {
      target[key] = Array.isArray(tgtVal) ? [...tgtVal, ...srcVal] : [...srcVal];
    } else if (isObject(srcVal)) {
      target[key] = deepMerge(isObject(tgtVal) ? { ...tgtVal } : {}, srcVal);
    } else {
      target[key] = srcVal;
    }
  });
  return target;
}

function baseOptions() {
  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true },
      datalabels: { display: false },
      centerText: { text: '', color: '#0f172a' }
    }
  };
  if (reduceMotionQuery.matches) {
    opts.animation = false;
  }
  return opts;
}

export function destroyChartSafe(chart) {
  if (!chart) return;
  try {
    chart.destroy();
  } catch (err) {
    console.warn('[analisev2] Failed to destroy chart instance', err);
    const canvas = chart.canvas;
    if (canvas?.getContext) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
}

export function createChart(target, config = {}, options = {}) {
  const Chart = ensureChartEnvironment();
  const canvas = resolveCanvas(target);
  if (!Chart || !canvas) return null;

  if (options.previousChart) {
    destroyChartSafe(options.previousChart);
  }

  const mergedOptions = deepMerge(baseOptions(), config.options || {});
  if (!mergedOptions.plugins.centerText) {
    mergedOptions.plugins.centerText = { text: '', color: '#0f172a' };
  }

  const finalConfig = {
    ...config,
    options: mergedOptions
  };

  return new Chart(canvas, finalConfig);
}
