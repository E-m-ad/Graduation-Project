import z from "../utils/assistant.zod.js";
import { generateAssistantReply } from "../services/assistant.js";

async function chat(req, res) {
  const data = z.assistantChatSchema.safeParse(req.body);

  if (!data.success) {
    return res.status(400).json({
      success: false,
      message: data.error.issues[0].message,
      error: {
        path: data.error.issues[0].path.join("."),
        message: data.error.issues[0].message,
      },
    });
  }

  try {
    const reply = await generateAssistantReply({
      user: req.user || null,
      payload: data.data,
    });

    return res.status(200).json({
      success: true,
      data: reply,
    });
  } catch (error) {
    console.error("assistant chat error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to generate an assistant reply right now",
    });
  }
}

export default {
  chat,
};
