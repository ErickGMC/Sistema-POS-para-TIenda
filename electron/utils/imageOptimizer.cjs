const sharp = require('sharp');

async function optimizeImageToWebp(inputBuffer, type = 'producto') {
    try {
        if (type === 'banner') {
            const buffer = await sharp(inputBuffer)
                .resize(1200, 300, {
                    fit: 'cover',
                    withoutEnlargement: true
                })
                .webp({ quality: 75 }) // Mayor compresión para banners
                .toBuffer();
                
            return { success: true, base64: `data:image/webp;base64,${buffer.toString('base64')}` };
        } else {
            // Producto: Generar la optimizada a 600x600
            const buffer = await sharp(inputBuffer)
                .resize(600, 600, {
                    fit: 'cover',
                    withoutEnlargement: true
                })
                .webp({ quality: 80 })
                .toBuffer();
                
            return { success: true, base64: `data:image/webp;base64,${buffer.toString('base64')}` };
        }
    } catch (error) {
        console.error('Error optimizando imagen:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    optimizeImageToWebp
};
