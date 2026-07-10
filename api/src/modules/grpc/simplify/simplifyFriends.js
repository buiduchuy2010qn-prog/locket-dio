const {
  getString,
  timestampToMillis,
  getBoolean,
  parseFirestoreValue,
} = require("../utils/firestoreConverts");

function simplifyFriends(data) {
  const document = data.document_change?.document;
  const fields = document?.fields;

  if (!document || !fields) return null;

  const friend = {
    uid: getString(fields.user),
    createdAt: timestampToMillis(document.create_time) || 0,
    updatedAt: timestampToMillis(document.update_time) || 0,
  };

  // Optional fields
  if (fields.hidden) {
    friend.hidden = getBoolean(fields.hidden);
  }

  if (fields.celebrity) {
    friend.isCelebrity = getBoolean(fields.celebrity);
  }

  if (fields.shared_history_on) {
    friend.sharedHistoryOn = timestampToMillis(
      parseFirestoreValue(fields.shared_history_on),
    );
  }

  return friend;
}

module.exports = { simplifyFriends };
