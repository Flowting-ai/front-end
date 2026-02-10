/**
 * Compresses an image file to reduce its size while maintaining reasonable quality
 * @param file - The image file to compress
 * @param maxWidth - Maximum width of the compressed image (default: 800)
 * @param maxHeight - Maximum height of the compressed image (default: 800)
 * @param quality - JPEG quality (0-1, default: 0.8)
 * @returns Promise with the compressed image as a data URL
 */
export async function compressImage(
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onerror = () => reject(new Error('Failed to load image'));
      
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          
          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Use better image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with specified quality
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        
        resolve(compressedDataUrl);
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Estimates the size of a data URL in bytes
 * @param dataUrl - The data URL to measure
 * @returns Size in bytes
 */
export function getDataUrlSize(dataUrl: string): number {
  // Remove data URL prefix and calculate base64 string size
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  
  // Each base64 character represents 6 bits
  // Padding characters (=) don't count
  const padding = (base64.match(/=/g) || []).length;
  return (base64.length * 6) / 8 - padding;
}

/**
 * Formats bytes to human-readable format
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
