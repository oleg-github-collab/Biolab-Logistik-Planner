-- Migration: Add barcode image storage for storage bins
-- This allows scanning and saving barcode/QR code images for later viewing

-- Add barcode_image_path column to storage_bins
ALTER TABLE storage_bins
ADD COLUMN IF NOT EXISTS barcode_image_path TEXT;

-- Add index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_storage_bins_keep_until_status
ON storage_bins(keep_until, status)
WHERE status = 'pending';

-- Add comment
COMMENT ON COLUMN storage_bins.barcode_image_path IS 'Path to stored barcode/QR code image for laser scanner viewing';
