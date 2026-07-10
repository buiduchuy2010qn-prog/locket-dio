import { instanceLocketV2 } from "@/libs";
import { generateUUIDv4Upper } from "@/utils/generate/uuid";

export const sendMessage = async (messageInfo) => {
  try {
    const body = {
      data: {
        msg: messageInfo.message || " ", // Nội dung tin nhắn
        analytics: {
          amplitude: {
            device_id: generateUUIDv4Upper(),
            session_id: -1,
          },
          google_analytics: {
            app_instance_id: "e88d4daed0ded172248753851bf67772",
          },
          android_version: "1.196.0",
          android_build: "406",
          platform: "android",
        },
        client_token: generateUUIDv4Upper(),
        moment_uid: messageInfo?.moment_id || null,
        receiver_uid: messageInfo.receiver_uid,
      },
    };

    const response = await instanceLocketV2.post("sendChatMessageV2", body);

    return response.data;
  } catch (err) {
    console.error("sendMessage error:", err);
    throw err;
  }
};

export const markReadMessage = async (conversationId) => {
  try {
    const body = {
      data: {
        conversation_uid: conversationId,
      },
    };

    const response = await instanceLocketV2.post("markAsRead", body);

    return response.data;
  } catch (err) {
    console.error("markReadMessage error:", err);
    throw err;
  }
};

export const markDevileredMessage = async (conversationId) => {
  try {
    const body = {
      data: {
        conversation_uid: conversationId,
        delivered_message_created_at: {
          _nanoseconds: {
            value: "354000000",
            "@type": "type.googleapis.com/google.protobuf.Int64Value",
          },
          _seconds: {
            "@type": "type.googleapis.com/google.protobuf.Int64Value",
            value: "1778596893",
          },
        },
      },
    };

    const response = await instanceLocketV2.post("markAsDevilered", body);

    return response.data;
  } catch (err) {
    console.error("markReadMessage error:", err);
    throw err;
  }
};

export const sendReactionOnMessage = async ({
  messageId,
  conversationId,
  emoji,
}) => {
  try {
    const body = {
      data: {
        message_id: messageId,
        emoji: emoji,
        conversation_id: conversationId,
      },
    };

    const response = await instanceLocketV2.post(
      "sendChatMessageReaction",
      body,
    );

    return response.data?.result?.status === 200;
  } catch (err) {
    console.error("markReadMessage error:", err);
    throw err;
  }
};

export const removeReactionOnMessage = async ({
  messageId,
  conversationId,
}) => {
  try {
    const body = {
      data: {
        message_id: messageId,
        conversation_id: conversationId,
      },
    };

    const response = await instanceLocketV2.post(
      "removeChatMessageReaction",
      body,
    );

    return response.data?.result?.status === 200;
  } catch (err) {
    console.error("markReadMessage error:", err);
    throw err;
  }
};

export const deleteMessage = async ({ messageId, conversationId }) => {
  try {
    const body = {
      data: {
        message_uid: messageId,
        conversation_uid: conversationId,
      },
    };

    const response = await instanceLocketV2.post("deleteChatMessage", body);

    return response.data?.result?.status === 200;
  } catch (err) {
    console.error("markReadMessage error:", err);
    throw err;
  }
};
