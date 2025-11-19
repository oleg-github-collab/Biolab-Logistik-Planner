const QRCode = require('qrcode');
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Generate a QR code image for a given code
 * @param {string} code - The code to encode in the QR code
 * @param {string} outputPath - Path where to save the QR code image
 * @returns {Promise<string>} - Path to the generated QR code image
 */
async function generateBarcodeImage(code, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create canvas
      const canvas = createCanvas(400, 400);

      // Generate QR code on canvas
      await QRCode.toCanvas(canvas, code, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H' // High error correction for better scanning
      });

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Save to file
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);

      logger.info('QR code generated successfully', {
        code,
        outputPath,
        size: buffer.length
      });

      resolve(outputPath);
    } catch (error) {
      logger.error('Error generating QR code', {
        code,
        outputPath,
        error: error.message
      });
      reject(error);
    }
  });
}

/**
 * Generate QR code for a storage bin and return the relative path
 * @param {string} code - Storage bin code
 * @returns {Promise<string>} - Relative path to QR code image (e.g., /uploads/barcodes/...)
 */
async function generateStorageBinBarcode(code) {
  try {
    // Sanitize code for filename
    const sanitizedCode = code.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `qrcode-${sanitizedCode}-${Date.now()}.png`;

    const uploadsDir = path.join(__dirname, '../../uploads/barcodes');
    const fullPath = path.join(uploadsDir, filename);

    await generateBarcodeImage(code, fullPath);

    const relativePath = `/uploads/barcodes/${filename}`;

    return relativePath;
  } catch (error) {
    logger.error('Error generating storage bin barcode', {
      code,
      error: error.message
    });
    throw error;
  }
}

/**
 * Delete barcode image file
 * @param {string} imagePath - Relative path to the barcode image
 */
function deleteBarcodeImage(imagePath) {
  try {
    if (!imagePath) return;

    const filename = path.basename(imagePath);
    const fullPath = path.join(__dirname, '../../uploads/barcodes', filename);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.info('Barcode image deleted', { path: imagePath });
    }
  } catch (error) {
    logger.warn('Failed to delete barcode image', {
      path: imagePath,
      error: error.message
    });
  }
}

module.exports = {
  generateBarcodeImage,
  generateStorageBinBarcode,
  deleteBarcodeImage
};
