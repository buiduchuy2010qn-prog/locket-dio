const {
  getString,
  timestampToSeconds,
  getBoolean,
  parseFirestoreValue,
} = require("../utils/firestoreConverts");
const { replaceFirebaseWithCDN } = require("../utils/replaceFirebaseWithCDN");

function simplifyConvertions(data, user_id) {
  const document = data.document_change?.document;
  const fields = document?.fields;

  const members = fields?.members?.array_value?.values || [];

  const with_user = members.find((item) => item.string_value !== user_id);
  if (!document || !fields) return null;

  const chat = {
    isRead: getBoolean(fields.is_read),
    // Tin nhắn mới nhất
    latestMessage: fields.latest_message?.map_value?.fields
      ? {
          body: fields.latest_message.map_value.fields.body?.string_value || "",
          sender:
            fields.latest_message.map_value.fields.sender?.string_value || "",
          createdAt:
            timestampToSeconds(
              fields.latest_message.map_value.fields.created_at
                ?.timestamp_value,
            ) || 0,
          replyMoment:
            fields.latest_message.map_value.fields.reply_moment?.string_value ||
            null,
          thumbnailUrl: replaceFirebaseWithCDN(
            fields.latest_message.map_value.fields.thumbnail_url?.string_value,
          ),
        }
      : null,
    uid: getString(fields.uid),
    update_time: timestampToSeconds(
      fields?.latest_message?.map_value?.fields?.created_at?.timestamp_value,
    ),

    members: parseFirestoreValue(fields.members),
    last_updated: parseFirestoreValue(fields?.last_updated),
    last_read_at: parseFirestoreValue(fields?.last_read_at),
    is_read: parseFirestoreValue(fields?.is_read),
    other_last_delivered_at: parseFirestoreValue(fields?.other_last_delivered_at),
    other_last_delivered_message_created_at: parseFirestoreValue(fields?.other_last_delivered_message_created_at),
    last_updated: parseFirestoreValue(fields?.last_updated),
    unread_count: parseFirestoreValue(fields?.unread_count),
    latest_message: parseFirestoreValue(fields.latest_message),

    sender: getString(fields.latest_message?.map_value?.fields?.sender),
    with_user: with_user?.string_value,
    lastUpdated: getString(fields.last_updated?.timestampValue) || 0,
    createTime: timestampToSeconds(document.create_time) || 0,
    updateTime: timestampToSeconds(document.update_time) || 0,
  };

  return chat;
}

function simplifyConvertionsV2(data, user_id) {
  const document = data.document_change?.document;
  const fields = document?.fields;

  const members = fields?.members?.array_value?.values || [];

  const with_user = members.find((item) => item.string_value !== user_id);
  if (!document || !fields) return null;

  const chat = {
    is_read: getBoolean(fields.is_read),
    last_read_at: timestampToSeconds(fields.last_read_at?.timestamp_value) || 0,
    last_updated: getString(fields.last_updated?.timestampValue) || 0,
    last_updated_at:
      timestampToSeconds(fields.last_updated?.timestamp_value) || 0,
    unread_count: parseInt(fields.unread_count?.integer_value || "0", 10),
    // Tin nhắn mới nhất
    latest_message: fields.latest_message?.map_value?.fields
      ? {
          body: fields.latest_message.map_value.fields.body?.string_value || "",
          sender:
            fields.latest_message.map_value.fields.sender?.string_value || "",
          created_at:
            timestampToSeconds(
              fields.latest_message.map_value.fields.created_at
                ?.timestamp_value,
            ) || 0,
          reply_moment:
            fields.latest_message.map_value.fields.reply_moment?.string_value ||
            null,
          thumbnail_url: replaceFirebaseWithCDN(
            fields.latest_message.map_value.fields.thumbnail_url?.string_value,
          ),
        }
      : null,
    members: fields.array_value,
    uid: getString(fields.uid),
    update_time: timestampToSeconds(
      fields?.latest_message?.map_value?.fields?.created_at?.timestamp_value,
    ),
    other_last_delivered_at:
      timestampToSeconds(fields.other_last_delivered_at?.timestamp_value) || 0,
    other_last_delivered_message_created_at:
      timestampToSeconds(
        fields.other_last_delivered_message_created_at?.timestamp_value,
      ) || 0,
    sender: getString(fields.latest_message?.map_value?.fields?.sender),
    with_user: with_user?.string_value,
    create_time: timestampToSeconds(document.create_time) || 0,
    update_time: timestampToSeconds(document.update_time) || 0,
  };

  return chat;
}

module.exports = { simplifyConvertions, simplifyConvertionsV2 };
