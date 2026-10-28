/**
 * Shared Gemini client. Every AI feature goes through here so there's one
 * place to change models, SDKs or retry behaviour.
 */
const { GoogleGenAI } = require('@google/genai');
const { geminiApiKey, geminiModel, geminiImageModel } = require('../config.json');

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

class SafetyBlockError extends Error {
    constructor(reason) {
        super(`SAFETY: response blocked (${reason})`);
        this.name = 'SafetyBlockError';
    }
}

function getBlockReason(response) {
    const promptBlock = response.promptFeedback?.blockReason;
    if (promptBlock) return promptBlock;
    const finish = response.candidates?.[0]?.finishReason;
    if (finish && ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(finish)) return finish;
    return null;
}

/**
 * Generate text from a prompt.
 * @param {string} prompt
 * @param {{ retries?: number, model?: string }} [options]
 * @returns {Promise<string>} Trimmed response text
 * @throws {SafetyBlockError} When Gemini refuses on safety grounds (never retried)
 */
async function generateText(prompt, { retries = 2, model = geminiModel } = {}) {
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await ai.models.generateContent({ model, contents: prompt });
            const blockReason = getBlockReason(response);
            if (blockReason) throw new SafetyBlockError(blockReason);

            const text = response.text?.trim();
            if (!text) throw new Error('Gemini returned an empty response');
            return text;
        }
        catch (error) {
            if (error instanceof SafetyBlockError || attempt >= retries) throw error;
            console.log(`Gemini retry ${attempt} after error:`, error.message);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

/**
 * Generate an image from a prompt.
 * @param {string} prompt
 * @returns {Promise<Buffer|null>} PNG bytes, or null if no image came back
 */
async function generateImage(prompt) {
    const response = await ai.models.generateContent({
        model: geminiImageModel,
        contents: prompt,
        config: { responseModalities: ['TEXT', 'IMAGE'] },
    });
    const blockReason = getBlockReason(response);
    if (blockReason) throw new SafetyBlockError(blockReason);

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(part => part.inlineData?.data);
    return imagePart ? Buffer.from(imagePart.inlineData.data, 'base64') : null;
}

/**
 * Generate text and parse the first JSON object in it.
 * @returns {Promise<Object|null>} Parsed object, or null if none was found
 */
async function generateJson(prompt, options) {
    const text = await generateText(prompt, options);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
}

module.exports = { generateText, generateImage, generateJson, SafetyBlockError };
