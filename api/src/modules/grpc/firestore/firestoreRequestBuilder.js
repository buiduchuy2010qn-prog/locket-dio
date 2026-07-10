// src/services/firestoreRequestBuilder.js

/**
 * Tạo request lấy danh sách tin nhắn với 1 user
 * @param {string} messageId - ID message của người nhắn tin
 * @param {number} timestamp - Timestamp để phân trang (optional)
 * @returns {Object} Firestore structured query request
 */
function buildGetMessagesWithUserRequest(messageId, timestamp) {
  console.log("Uid Message", messageId);

  return {
    database: "projects/locket-4252a/databases/(default)",
    add_target: {
      query: {
        parent: `projects/locket-4252a/databases/(default)/documents/conversations/${messageId}`,
        structured_query: {
          from: [{ collection_id: "messages" }],
          limit: { value: 50 },
          order_by: [
            {
              direction: "DESCENDING",
              field: { field_path: "created_at" },
            },
          ],
          start_at: timestamp
            ? {
                before: true,
                values: [{ timestamp_value: { seconds: timestamp } }],
              }
            : undefined,
        },
      },
      target_id: 12,
    },
  };
}

/**
 * Tạo request lấy danh sách conversation
 * @param {string} userId - UID của user
 * @param {number} timestamp - Timestamp để phân trang (optional)
 * @returns {Object} Firestore structured query request
 */
function buildGetListMessageRequest(userId, timestamp, limit = 50) {
  return {
    database: "projects/locket-4252a/databases/(default)",
    add_target: {
      query: {
        parent: `projects/locket-4252a/databases/(default)/documents/users/${userId}`,
        structured_query: {
          from: [{ collection_id: "conversations" }],
          order_by: [
            {
              field: { field_path: "last_updated" },
              direction: "DESCENDING",
            },
          ],

          limit: { value: limit },
          start_at: timestamp
            ? {
                before: false,
                values: [{ timestamp_value: { seconds: timestamp } }],
              }
            : undefined,
        },
      },
      target_id: 8,
    },
  };
}

function buildGetAllMoments({ userId, timestamp, byUserId, limit = 60 }) {
  return {
    database: "projects/locket-4252a/databases/locket",
    add_target: {
      target_id: 2,
      query: {
        parent: `projects/locket-4252a/databases/locket/documents/history/${userId}`,
        structured_query: {
          from: [{ collection_id: "entries" }],
          order_by: [
            { direction: "DESCENDING", field: { field_path: "date" } },
            { direction: "DESCENDING", field: { field_path: "__name__" } },
          ],
          limit: { value: limit },
          start_at: timestamp
            ? {
                before: true,
                values: [{ timestamp_value: { seconds: timestamp } }],
              }
            : undefined,
          where: byUserId
            ? {
                field_filter: {
                  field: {
                    field_path: "user",
                  },
                  op: "EQUAL",
                  value: {
                    string_value: byUserId,
                  },
                },
              }
            : undefined,
        },
      },
    },
  };
}

function buildGetFriends({ userId, limit = 10000 }) {
  return {
    database: "projects/locket-4252a/databases/(default)",
    add_target: {
      target_id: 2,
      query: {
        parent: `projects/locket-4252a/databases/(default)/documents/users/${userId}`,
        structured_query: {
          from: [{ collection_id: "friends" }],
          order_by: [
            // { direction: "DESCENDING", field: { field_path: "date" } },
            { direction: "ASCENDING", field: { field_path: "__name__" } },
          ],
          limit: { value: limit },
        },
      },
    },
  };
}

function buildGetMomentReactions({ momentId, limit = 10000 }) {
  return {
    database: "projects/locket-4252a/databases/(default)",
    add_target: {
      target_id: 5,
      query: {
        parent: `projects/locket-4252a/databases/(default)/documents/moments/${momentId}`,
        structured_query: {
          from: [{ collection_id: "reactions" }],
          order_by: [
            // { direction: "DESCENDING", field: { field_path: "date" } },
            // { direction: "ASCENDING", field: { field_path: "__name__" } },
          ],
          limit: { value: limit },
        },
      },
    },
  };
}
// Export theo CommonJS
module.exports = {
  buildGetMessagesWithUserRequest,
  buildGetListMessageRequest,
  buildGetAllMoments,
  buildGetFriends,
  buildGetMomentReactions,
};
