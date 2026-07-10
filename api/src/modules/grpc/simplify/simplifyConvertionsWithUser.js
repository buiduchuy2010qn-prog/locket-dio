const { getString, timestampToSeconds, getReactionsArray } = require("../utils/firestoreConverts");
const { replaceFirebaseWithCDN } = require("../utils/replaceFirebaseWithCDN");

function parseFirestorePath(name = "") {
  const parts = name.split("/");

  const convIndex = parts.indexOf("conversations");
  const msgIndex = parts.indexOf("messages");

  return {
    conversationId: convIndex !== -1 ? parts[convIndex + 1] : null,
    messageUid: msgIndex !== -1 ? parts[msgIndex + 1] : null,
  };
}

function simplifyConvertionsWithUser(data) {
  const document = data.document_change?.document;
  const fields = document?.fields;

  if (!document || !fields) return null;

  const { conversationId, messageUid } = parseFirestorePath(document.name);

  const message = {
    uid: conversationId,
    id: messageUid,
    client_token:  getString(fields.client_token),
    text: getString(fields.body),
    sender: getString(fields.sender),
    thumbnail_url: replaceFirebaseWithCDN(getString(fields.thumbnail_url)),
    reply_moment: getString(fields.reply_moment),
    reactions: getReactionsArray(fields.reactions),
    create_time: timestampToSeconds(document.create_time) || 0,
    update_time: timestampToSeconds(document.update_time) || 0,
  };

  return message;
}

module.exports = { simplifyConvertionsWithUser };
