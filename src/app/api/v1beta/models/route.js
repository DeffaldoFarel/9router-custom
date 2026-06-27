import { PROVIDER_MODELS } from "@/shared/constants/models";
import { extractApiKey, isValidApiKey } from "@/sse/services/auth";
import { isModelAllowed } from "@/lib/modelMatcher";

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}

/**
 * GET /v1beta/models - Gemini compatible models list
 * Returns models in Gemini API format
 */
export async function GET(request) {
  try {
    let models = [];
    const seen = new Set();

    // Check API Key restrictions
    const apiKey = extractApiKey(request);
    let allowedModelsFilter = [];
    if (apiKey) {
      const keyRecord = await isValidApiKey(apiKey, true);
      if (keyRecord?.allowedModels?.length > 0) {
        allowedModelsFilter = keyRecord.allowedModels;
      }
    }

    function addModel({ name, displayName, description, methods = ["generateContent"] }) {
      if (seen.has(name)) return;
      
      // Filter out if restricted
      if (allowedModelsFilter.length > 0) {
        // Strip 'models/' prefix to test against matchPattern rules like 'anthropic/claude-3-opus'
        const baseId = name.replace(/^models\//, "");
        if (!isModelAllowed(allowedModelsFilter, baseId)) return;
      }
      
      seen.add(name);
      models.push({
        name,
        displayName,
        description,
        supportedGenerationMethods: methods,
        inputTokenLimit: 128000,
        outputTokenLimit: 8192,
      });
    }
    
    for (const [provider, providerModels] of Object.entries(PROVIDER_MODELS)) {
      for (const model of providerModels) {
        addModel({
          name: `models/${provider}/${model.id}`,
          displayName: model.name || model.id,
          description: `${provider} model: ${model.name || model.id}`,
        });

        if (provider === "gemini") {
          addModel({
            name: `models/${model.id}`,
            displayName: model.name || model.id,
            description: `Gemini model: ${model.name || model.id}`,
            methods: ["generateContent", "streamGenerateContent"],
          });
        }
      }
    }

    return Response.json({ models });
  } catch (error) {
    console.log("Error fetching models:", error);
    return Response.json({ error: { message: error.message } }, { status: 500 });
  }
}
