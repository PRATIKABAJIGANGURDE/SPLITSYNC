import * as ImagePicker from 'expo-image-picker';
import { GoogleGenerativeAI } from "@google/generative-ai";

interface ScanResult {
    billAmount?: number;
    taxAmount?: number;
    totalAmount?: number;
    items?: { name: string; amount: number }[];
}

export const processBillImage = async (base64: string): Promise<ScanResult> => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please add EXPO_PUBLIC_GEMINI_API_KEY to your .env file");
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Remove data prefix if present for Gemini
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");

        const prompt = `
        Analyze this receipt image. 
        Extract the following:
        1. Total Bill Amount (final total to pay).
        2. Tax/GST Amount (if visible).
        3. List of individual items with their prices.
        
        Return ONLY a raw JSON object (no markdown, no backticks) with this structure:
        {
          "billAmount": number,
          "taxAmount": number, 
          "totalAmount": number,
          "items": [
            { "name": "Item Name", "amount": number }
          ]
        }
        Do not include sub-items if they are part of a main item. Ignore "Total" or "Subtotal" lines in the items list.
        `;

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: "image/jpeg",
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if Gemini returns them
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const data = JSON.parse(cleanedText);

        return {
            billAmount: parseFloat((data.billAmount || data.totalAmount).toFixed(2)), // Fallback
            taxAmount: parseFloat((data.taxAmount || 0).toFixed(2)),
            totalAmount: parseFloat(data.totalAmount.toFixed(2)),
            items: (data.items || []).map((item: any) => ({
                ...item,
                amount: parseFloat(item.amount.toFixed(2))
            })),
        };

    } catch (error) {
        console.error("Gemini OCR Error:", error);
        throw new Error("Failed to parse receipt with AI. Please try again.");
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