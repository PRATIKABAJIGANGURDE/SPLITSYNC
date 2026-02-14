import * as ImagePicker from 'expo-image-picker';

interface ScanResult {
    billAmount?: number;
    taxAmount?: number;
    totalAmount?: number;
    items?: { name: string; amount: number }[];
}

export const processBillImage = async (base64: string): Promise<ScanResult> => {
    const apiKey = process.env.EXPO_PUBLIC_OCR_API_KEY || 'helloworld';
    // Ensure base64 string has the data prefix if missing (though usually it might not need it for this API, but consistency helps)
    // Actually OCR.space expects "data:image/..." or just base64? 
    // The previous code did: `data:image/jpeg;base64,${result.assets[0].base64}`
    // So let's ensure we have that.
    const base64Img = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;

    try {
        const formData = new FormData();
        formData.append('base64Image', base64Img);
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');
        formData.append('OCREngine', '2');

        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            headers: { 'apikey': apiKey },
            body: formData,
        });

        const data = await response.json();

        if (data.IsErroredOnProcessing) {
            throw new Error(data.ErrorMessage?.[0] || 'OCR Processing Failed');
        }

        const parsedText = data.ParsedResults?.[0]?.ParsedText || "";
        const lines = parsedText.split('\n');
        let bill = 0;
        let tax = 0;

        const findAmount = (line: string) => {
            const matches = line.match(/[\d,]+\.\d{2}/g) || line.match(/\d+/g);
            if (matches) {
                const val = parseFloat(matches[matches.length - 1].replace(/,/g, ''));
                return isNaN(val) ? 0 : val;
            }
            return 0;
        };

        lines.forEach((line: string) => {
            const lower = line.toLowerCase();
            if ((lower.includes('total') || lower.includes('amount') || lower.includes('grand')) && !lower.includes('sub')) {
                const val = findAmount(line);
                if (val > bill) bill = val;
            }
            if (lower.includes('tax') || lower.includes('gst') || lower.includes('vat')) {
                const val = findAmount(line);
                if (val > tax && val < bill) tax = val;
            }
        });

        return {
            billAmount: bill > 0 ? (bill - tax) : 0,
            taxAmount: tax,
            totalAmount: bill,
        };

    } catch (error) {
        console.error("OCR Error:", error);
        throw error;
    }
};

/**
 * Legacy/System Camera Picker
 */
export const scanBill = async (): Promise<ScanResult | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
        throw new Error('Camera permission is required to scan bills.');
    }

    const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        base64: true,
    });

    if (result.canceled || !result.assets[0].base64) {
        return null;
    }

    return processBillImage(result.assets[0].base64);
};
