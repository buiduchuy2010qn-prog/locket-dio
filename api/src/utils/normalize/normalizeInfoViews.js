/**
 * Chuẩn hoá views
 */
function normalizeViews(documents) {
  return documents.map((doc) => {
    const fields = doc.fields || {};
    return {
      id: doc.name.split("/").pop(), // id document view
      user: fields.user?.stringValue || null,
      viewedAt: fields.viewed_at?.timestampValue || null,
    };
  });
}
module.exports = {
  normalizeViews,
};