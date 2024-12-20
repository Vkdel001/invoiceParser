const express = require('express');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const app = express();
app.use(express.json());

// DocuClipper API details
const uploadUrl = 'https://www.docuclipper.com/api/v1/protected/document?asyncProcessing=false';
const jobUrl = 'https://www.docuclipper.com/api/v1/protected/job';
const jobStatusUrl = 'https://www.docuclipper.com/api/v1/protected/job';
const jobExportUrl = 'https://www.docuclipper.com/api/v1/protected/job';
const apiKey =  process.env.API_KEY;

// Helper function to wait for a specific time
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Endpoint to handle the entire flow
app.post('/process-file', async (req, res) => {
  try {
    const fileUrl = req.body.fileUrl;
    console.log('Received file URL:', fileUrl);

    const downloadPath = './temp-file.pdf';

    console.log('Downloading the file...');
    const response = await axios({
      method: 'get',
      url: fileUrl,
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(downloadPath);
    response.data.pipe(writer);

    writer.on('finish', async () => {
      console.log('File downloaded successfully.');

      const form = new FormData();
      form.append('document', fs.createReadStream(downloadPath));

      console.log('Uploading the file to DocuClipper...');
      const uploadResponse = await axios.post(uploadUrl, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const documentId = uploadResponse.data.document.id;
      console.log('Extracted document ID:', documentId);

      const jobPayload = {
        templateId: null,
        documents: [documentId],
        documentsToSplit: [],
        enableMultiPage: false,
        jobName: "",
        jobType: "Invoice",
        selectedTemplateFields: null,
        isGeneric: false,
        enableBankMode: true,
      };

      console.log('Submitting job to DocuClipper...');
      const jobResponse = await axios.post(jobUrl, jobPayload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const jobId = jobResponse.data.id;
      console.log('Extracted Job ID:', jobId);

 

        let jobStatus = 'InProgress';

        while (jobStatus === 'InProgress') {
          console.log('Fetching job status...');
          const jobStatusResponse = await axios.get(`${jobStatusUrl}/${jobId}`, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          });
    
          jobStatus = jobStatusResponse.data.status;
          console.log('Current job status:', jobStatus);
    
          if (jobStatus === 'InProgress') {
            console.log('Job is still in-progress. Waiting for 60 seconds...');
            await delay(20000); // Wait for 20 seconds
          }
        }














      console.log('Exporting job results from DocuClipper...');
      const exportPayload = {
        format: 'json',
        flattenTables: true,
        jobType: 'Invoice',
        dateFormat: 'YYYY-MM-DD',
        separateFilesForAccounts: true,
        fileType: 'CSV',
        selectedFieldNames: ['invoiceMode'],
      };

  

      const exportResponse = await axios.post(`${jobExportUrl}/${jobId}/export`, exportPayload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Job exported successfully:', exportResponse.data);

      res.status(200).json({
        message: 'File processed, job submitted, and results exported successfully',
        documentId,
        jobId,
        jobStatus,
        exportData: exportResponse.data,
      });

      fs.unlinkSync(downloadPath);
    });

    writer.on('error', (err) => {
      console.error('Error writing file:', err.message);
      res.status(500).json({ error: 'Failed to download file' });
    });
  } catch (error) {
    console.error('Error processing file:', error.message);
    res.status(500).json({ error: 'An error occurred', details: error.message });
  }
});

 

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



  
});
