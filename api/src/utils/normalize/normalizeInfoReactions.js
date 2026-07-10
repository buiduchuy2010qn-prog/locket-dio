/**
 * Chuẩn hoá reactions
 */
function normalizeReactions(documents) {
  return documents.map((doc) => {
    const fields = doc.fields || {};
    return {
      id: doc.name.split("/").pop(), // id document reaction
      user: fields.user?.stringValue || null,
      emoji: fields.string?.stringValue || null,
      intensity: parseInt(fields.intensity?.integerValue || "0", 10),
      createdAt: fields.created_at?.timestampValue || null,
    };
  });
}

module.exports = {
  normalizeReactions,
};