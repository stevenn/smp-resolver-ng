import { SMPResolver, CSVExporter } from '@stevenn/smp-resolver-ng';

async function exportToCSV() {
  const resolver = new SMPResolver();
  
  const participantIds = [
    '0208:0843766574',  // Satisa
    '0208:0755752833',  // Bart Van Der Auwelaer Consultancy
    '0208:0848934496',  // OpenPeppol AISBL
    '0208:0203201340',  // Banque Nationale de Belgique
    '0208:0776413833'   // Blue Rock Accounting (not registered)
  ];
  
  console.log('Processing participants...');
  
  const results = await resolver.resolveBatch(participantIds, {
    concurrency: 10,
    onProgress: (done, total) => {
      process.stdout.write(`\rProgress: ${done}/${total}`);
    }
  });
  
  console.log('\n\nCSV Output:');
  console.log(CSVExporter.formatBulkResults(results));
  
  console.log('\nSummary Report:');
  console.log(CSVExporter.createSummaryReport(results));
  
  await resolver.close();
}

exportToCSV().catch(console.error);