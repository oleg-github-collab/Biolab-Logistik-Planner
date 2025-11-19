const QRCode = require('qrcode');
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
  try {
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Generate QR code and save directly to file
    await QRCode.toFile(outputPath, code, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H', // High error correction for better scanning
      type: 'png'
    });

    logger.info('QR code generated successfully', {
      code,
      outputPath
    });

    return outputPath;
  } catch (error) {
    logger.error('Error generating QR code', {
      code,
      outputPath,
      error: error.message
    });
    throw error;
  }
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
