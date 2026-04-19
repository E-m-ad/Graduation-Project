import {
  getAiRecommenderTimeoutMs,
  getAiRecommenderUrl,
} from "../utils/runtime-config.js";

const AI_RECOMMENDER_RETRY_COOLDOWN_MS = 60 * 1000;

const aiRecommenderState = {
  blockedUntil: 0,
  lastFailureReason: "",
};

function closeCircuit() {
  aiRecommenderState.blockedUntil = 0;
  aiRecommenderState.lastFailureReason = "";
}

function openCircuit(path, reason) {
  const now = Date.now();
  const normalizedReason = reason || "request failed";
  const shouldLog =
    aiRecommenderState.blockedUntil <= now ||
    aiRecommenderState.lastFailureReason !== normalizedReason;

  aiRecommenderState.blockedUntil =
    now + AI_RECOMMENDER_RETRY_COOLDOWN_MS;
  aiRecommenderState.lastFailureReason = normalizedReason;

  if (shouldLog) {
    console.warn(
      `[ai-recommender] ${path} unavailable (${normalizedReason}). Falling back to the built-in scorer for ${Math.floor(
        AI_RECOMMENDER_RETRY_COOLDOWN_MS / 1000,
      )}s.`,
    );
  }
}

function getErrorMessage(error) {
  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return "request failed";
}

async function postJson(path, payload, env = process.env) {
  const serviceUrl = getAiRecommenderUrl(env);
  if (!serviceUrl) {
    return null;
  }

  if (aiRecommenderState.blockedUntil > Date.now()) {
    return null;
  }

  try {
    const response = await fetch(`${serviceUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(getAiRecommenderTimeoutMs(env)),
    });

    if (!response.ok) {
      openCircuit(path, `HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    closeCircuit();
    return data;
  } catch (error) {
    openCircuit(path, getErrorMessage(error));
    return null;
  }
}

export async function scorePersonalizedCandidates(payload, env = process.env) {
  const response = await postJson("/score/recommendations", payload, env);
  return Array.isArray(response?.items) ? response.items : null;
}

export async function scoreSimilarCandidates(payload, env = process.env) {
  const response = await postJson("/score/similar", payload, env);
  return Array.isArray(response?.items) ? response.items : null;
}
