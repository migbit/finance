import { db } from './script.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { showToast } from './toast.js';

document.getElementById('export-all-btn')?.addEventListener('click', exportAllData);

const TOP_LEVEL_COLLECTIONS = [
  'faturas',
  'faturasEmFalta',
  'caixa',
  'cryptoportfolio_investments',
  'cryptoportfolio_monthly_totals',
  'cryptoportfolio_apy',
  'dca_data',
  'reparacoes',
  'family_finance_accounts',
  'family_finance_quotes',
  'family_finance_quote_history',
  'family_finance_meta',
  'family_finance_audit'
];

const FAMILY_FINANCE_SUBCOLLECTIONS = [
  'requests',
  'ledger',
  'vaults',
  'positions',
  'goals'
];

async function exportAllData() {
  showToast('A exportar dados...', 'info', 10000);

  try {
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '2.0',
      data: {}
    };

    for (const collectionName of TOP_LEVEL_COLLECTIONS) {
      exportData.data[collectionName] = await exportCollection(collectionName);
    }

    const accountIds = new Set([
      'francisca',
      'leonor',
      ...(exportData.data.family_finance_accounts || []).map(account => account.id).filter(Boolean)
    ]);
    for (const accountId of accountIds) {
      for (const subcollectionName of FAMILY_FINANCE_SUBCOLLECTIONS) {
        const path = `family_finance_accounts/${accountId}/${subcollectionName}`;
        exportData.data[path] = await exportCollection(path);
      }
    }

    // Create download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `a-app-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Save export timestamp
    localStorage.setItem('last_export_date', new Date().toISOString());
    updateLastExportLabel();

    showToast('Exportação concluída!', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showToast('Erro ao exportar dados', 'error');
  }
}

async function exportCollection(collectionPath) {
  try {
    const snapshot = await getDocs(collection(db, collectionPath));
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.warn(`Erro ao exportar collection ${collectionPath}:`, error);
    return [];
  }
}

function updateLastExportLabel() {
  const lastExport = localStorage.getItem('last_export_date');
  const el = document.getElementById('last-export');
  if (el && lastExport) {
    const date = new Date(lastExport);
    el.textContent = date.toLocaleString('pt-PT');
  }
}

document.addEventListener('DOMContentLoaded', updateLastExportLabel);
