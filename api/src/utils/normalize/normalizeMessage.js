const { replaceFirebaseWithCDN } = require("../replace/replaceFirebaseWithCDN");

function normalizeMessage(doc) {
  if (!doc || !doc.fields) return null;

  const f = doc.fields;

  return {
    id: f.uid?.stringValue || doc.name?.split("/").pop(),
    members: f.members?.arrayValue?.values?.map((v) => v.stringValue) || [],
    unreadCount: parseInt(f.unread_count?.integerValue || "0", 10),
    isRead: f.is_read?.booleanValue || false,

    lastReadAt: f.last_read_at?.timestampValue || null,
    otherLastReadAt: f.other_last_read_at?.timestampValue || null,
    lastUpdated: f.last_updated?.timestampValue || null,

    sender: f.latest_message.mapValue.fields.sender?.stringValue || "",

    // Tin nhắn mới nhất
    latestMessage: f.latest_message?.mapValue?.fields
      ? {
          body: f.latest_message.mapValue.fields.body?.stringValue || "",
          sender: f.latest_message.mapValue.fields.sender?.stringValue || "",
          createdAt:
            f.latest_message.mapValue.fields.created_at?.timestampValue || null,
          replyMoment:
            f.latest_message.mapValue.fields.reply_moment?.stringValue || null,
          thumbnailUrl: replaceFirebaseWithCDN(
            f.latest_message.mapValue.fields.thumbnail_url?.stringValue
          ),
        }
      : null,

    otherLastDeliveredAt: f.other_last_delivered_at?.timestampValue || null,
    otherLastDeliveredMessageCreatedAt:
      f.other_last_delivered_message_created_at?.timestampValue || null,

    createTime: doc.createTime || null,
    updateTime: doc.updateTime || null,
  };
}

module.exports = {
  normalizeMessage,
};
