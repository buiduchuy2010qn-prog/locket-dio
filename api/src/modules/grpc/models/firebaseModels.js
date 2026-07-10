// firebase.model.js

/**
 * @enum {string}
 */
const TargetChangeType = {
  NO_CHANGE: "NO_CHANGE",
  ADD: "ADD",
  REMOVE: "REMOVE",
  CURRENT: "CURRENT",
  RESET: "RESET",
};

/**
 * @typedef {Object} TargetChange
 * @property {TargetChangeType} [target_change_type]
 * @property {number[]} [target_ids]
 * @property {Status} [cause]
 * @property {string} [resume_token]
 * @property {string} [read_time] // ISO 8601 timestamp
 */

/**
 * @typedef {Object} DocumentChange
 * @property {Document} [document]
 * @property {number[]} [target_ids]
 * @property {number[]} [removed_target_ids]
 */

/**
 * @typedef {Object} DocumentDelete
 * @property {string} [document]
 * @property {string} [read_time]
 * @property {number[]} [removed_target_ids]
 */

/**
 * @typedef {Object} DocumentRemove
 * @property {string} [document]
 * @property {number[]} [removed_target_ids]
 * @property {string} [read_time]
 */

/**
 * @typedef {Object} ExistenceFilter
 * @property {number} [target_id]
 * @property {number} [count]
 */

/**
 * @typedef {Object} Document
 * @property {string} [name]
 * @property {Object.<string, Value>} [fields]
 * @property {TimestampValue} create_time
 * @property {TimestampValue} update_time
 */

/**
 * @typedef {Object} Value
 * @property {null} [null_value]
 * @property {boolean} [boolean_value]
 * @property {string} [integer_value]
 * @property {number} [double_value]
 * @property {TimestampValue} [timestamp_value]
 * @property {string} [string_value]
 * @property {string} [bytes_value]
 * @property {string} [reference_value]
 * @property {{ latitude: number, longitude: number }} [geo_point_value]
 * @property {{ values: Value[] }} [array_value]
 * @property {{ fields: Object.<string, Value> }} [map_value]
 */

/**
 * @typedef {Object} Status
 * @property {number} [code]
 * @property {string} [message]
 * @property {any[]} [details]
 */

/**
 * @typedef {Object} TimestampValue
 * @property {string} [seconds]
 * @property {number} [nanos]
 */

/**
 * @typedef {Object} ListenResponse
 * @property {TargetChange} [target_change]
 * @property {DocumentChange} [document_change]
 * @property {DocumentDelete} [document_delete]
 * @property {DocumentRemove} [document_remove]
 * @property {ExistenceFilter} [filter]
 */

module.exports = {
  TargetChangeType,
};
