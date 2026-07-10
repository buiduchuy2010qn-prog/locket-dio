function normalizeFriendRequets(documents) {
  return documents.map((doc) => {
    return {
      uid: doc.fields?.requesting_user?.stringValue || null,
      to: doc.fields?.requested_user?.stringValue || null,
      date: doc.fields?.created_at?.timestampValue || doc.createTime,
      shareEligible: doc.fields?.share_history_eligible?.booleanValue ?? false,
      docId: doc.name.split("/").pop(),
    };
  });
}
module.exports = {
  normalizeFriendRequets,
};
