function getString(field) {
  return field?.string_value;
}

function getInteger(field) {
  const value = field?.integer_value;
  return value !== undefined ? parseInt(value, 10) : 0;
}

function getBoolean(field) {
  return field?.boolean_value;
}

function getMap(field) {
  return field?.map_value?.fields;
}

function timestampToSeconds(timestamp) {
  if (!timestamp) return 0;
  return Number(timestamp.seconds || 0);
}

function timestampToMillis(timestamp) {
  if (!timestamp) return 0;
  const seconds = Number(timestamp.seconds || 0);
  const nanos = Number(timestamp.nanos || 0);
  return seconds * 1000 + Math.floor(nanos / 1e6);
}

function parseFirestoreValue(v) {
  if (!v) return null;
  if (v.string_value !== undefined) return v.string_value;
  if (v.integer_value !== undefined) return parseInt(v.integer_value, 10);
  if (v.double_value !== undefined) return parseFloat(v.double_value);
  if (v.boolean_value !== undefined) return v.boolean_value;
  if (v.timestamp_value !== undefined) return timestampToMillis(v.timestamp_value);
  if (v.map_value !== undefined) {
    const fields = v.map_value.fields || {};
    const obj = {};
    for (const key in fields) {
      obj[key] = parseFirestoreValue(fields[key]);
    }
    return obj;
  }
  if (v.array_value !== undefined) {
    return (v.array_value.values || []).map(parseFirestoreValue);
  }
  return null;
}

function getReactionsArray(reactionsField) {
  const reactionsArray = reactionsField?.array_value?.values;
  if (!Array.isArray(reactionsArray)) return [];

  return reactionsArray.map((item) => {
    const rFields = item.map_value?.fields || {};
    return {
      sender: getString(rFields.sender),
      emoji: getString(rFields.emoji),
      created_at: timestampToSeconds(rFields.created_at?.timestamp_value),
    };
  });
}

module.exports = {
  getString,
  getInteger,
  getBoolean,
  getMap,
  timestampToSeconds,
  timestampToMillis,
  parseFirestoreValue,
  getReactionsArray,
};
