const SocketEvents = {

  NEW_MESSAGE: "new_message",

  NEW_ON_LIST_MESSAGE: "new_on_list_message",
  NEW_MESSAGE_WITH_USER: "new_message_with_user",

  NEW_ON_MOMENTS: "new_on_moments",
  NEW_ON_FRIENDS: "new_on_friends",

  ERROR: "server_error",
};

const SocketNamespaces = {
  GET_LIST_MESSAGE: "get_list_message",
  GET_LIST_MESSAGE_V2: "get_list_message_v2",
  GET_LIST_MESSAGE_WITH_USER: "get_messages_with_user",

  ON_MOMENTS: "on_moments",
};

/**
 * @typedef {Object} GetMessageModel
 * @property {string} [with_user] - ID của user cần chat cùng
 * @property {string|number} [timestamp] - Thời điểm bắt đầu lấy tin nhắn
 */

module.exports = {
  SocketEvents,
  SocketNamespaces,
};
