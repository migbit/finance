import { db } from './script.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { showToast } from './toast.js';

document.getElementById('export-all-btn')?.addEventListener('click', exportAllData);

async function exportAllData() {
  showToast('A exportar dados...', 'info', 10000);

  try {
    const collections = ['faturas', 'caixa', 'cryptoportfolio_investments', 'cryptoportfolio_monthly_totals', 'cryptoportfolio_apy', 'dca_data', 'reparacoes'];
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      data: {}
    };

    for (const collectionName of collections) {
      try {
        const snapshot = await getDocs(collection(db, collectionName));
        exportData.data[collectionName] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.warn(`Erro ao exportar collection ${collectionName}:`, error);
        exportData.data[collectionName] = [];
      }
    }

    // Create download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-backup-${new Date().toISOString().split('T')[0]}.json`;
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

function updateLastExportLabel() {
  const lastExport = localStorage.getItem('last_export_date');
  const el = document.getElementById('last-export');
  if (el && lastExport) {
    const date = new Date(lastExport);
    el.textContent = date.toLocaleString('pt-PT');
  }
}

document.addEventListener('DOMContentLoaded', updateLastExportLabel);
