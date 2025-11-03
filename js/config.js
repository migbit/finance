export const CONFIG = {
  HOST: location.hostname,
  ON_FIREBASE: /\.web\.app$/.test(location.hostname) || /firebaseapp\.com$/.test(location.hostname),
  CF_URL: 'https://europe-west1-apartments-a4b17.cloudfunctions.net/binancePortfolio',
  API_URL: null,
  SMALL_USD_THRESHOLD: 5,
  HIDE_SYMBOLS: new Set(['NEBL', 'ETHW']),
  SYMBOL_ALIASES: {
    O: 'LDO'
  },
  LOCATION_CHOICES: [
    'Binance Spot',
    'Binance Earn Flexible',
    'Binance Staking',
    'Binance Earn Locked',
    'Ledger',
    'Ledger staking.chain.link'
  ],
  COINGECKO: {
    PRICE_TTL_MS: 1000 * 60 * 60,
    BATCH_SIZE: 25,
    RETRY_DELAYS: [0, 500, 1000],
    RATE_LIMIT_DELAY: 1200
  },
  META_COLLECTION: 'cryptoportfolio_meta',
  META_DOC: 'invested',
  INVESTMENTS_COLLECTION: 'cryptoportfolio_investments',
  MONTHLY_TOTALS_COLLECTION: 'cryptoportfolio_monthly_totals',
  APY_COLLECTION: 'cryptoportfolio_apy',
  MONTHLY_ASSETS_COLLECTION: 'cryptoportfolio_monthly_assets'
};

CONFIG.API_URL = CONFIG.ON_FIREBASE ? '/api/portfolio' : CONFIG.CF_URL;

