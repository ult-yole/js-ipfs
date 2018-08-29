'use strict'

const { Record } = require('libp2p-record')
const { Key } = require('interface-datastore')
const errcode = require('err-code')

const debug = require('debug')
const log = debug('datastore-pubsub:publisher')
log.error = debug('datastore-pubsub:publisher:error')

// DatastorePubsub is responsible for providing an [interface-datastore]{@link https://github.com/ipfs/interface-datastore}
// compliant api for pubsub.
class DatastorePubsub {
  /**
   * Creates an instance of DatastorePubsub.
   * @param {*} pubsub - pubsub implementation.
   * @param {*} datastore - datastore instance.
   * @param {*} peerId - peer-id instance.
   * @param {Object} validator - validator functions.
   * @param {function(record, peerId, callback)} validator.validate - function to validate a record.
   * @param {function(received, current, callback)} validator.select - function to select the newest between two records.
   * @memberof DatastorePubsub
   */
  constructor (pubsub, datastore, peerId, validator) {
    this._pubsub = pubsub
    this._datastore = datastore
    this._peerId = peerId
    this._validator = validator

    // Bind _handleSubscription function, which is called by pubsub.
    this._handleSubscription = this._handleSubscription.bind(this)
  }

  /**
   * Publishes a value through pubsub.
   * @param {Key} key identifier of the value to be published.
   * @param {Buffer} val value to be propagated.
   * @param {function(Error)} callback
   * @returns {void}
   */
  put (key, val, callback) {
    if (!(key instanceof Key)) {
      const errMsg = `datastore key does not have a valid format`

      log.error(errMsg)
      return callback(errcode(new Error(errMsg), 'ERR_INVALID_DATASTORE_KEY'))
    }

    if (!Buffer.isBuffer(val)) {
      const errMsg = `received value is not a buffer`

      log.error(errMsg)
      return callback(errcode(new Error(errMsg), 'ERR_INVALID_VALUE_RECEIVED'))
    }

    log(`publish value for key ${key}`)

    // Publish record to pubsub
    const stringifiedTopic = key._buf.toString()
    this._pubsub.publish(stringifiedTopic, val, callback)
  }

  /**
   * Try to subscribe a topic with Pubsub and returns the local value if available.
   * @param {Key} key identifier of the value to be subscribed.
   * @param {function(Error, Buffer)} callback
   * @returns {void}
   */
  get (key, callback) {
    if (!(key instanceof Key)) {
      const errMsg = `datastore key does not have a valid format`

      log.error(errMsg)
      return callback(errcode(new Error(errMsg), 'ERR_INVALID_DATASTORE_KEY'))
    }

    log(`subscribe values for key ${key}`)

    // Subscribe
    const stringifiedTopic = key._buf.toString()
    this._pubsub.subscribe(stringifiedTopic, this._handleSubscription, (err) => {
      if (err) {
        const errMsg = `cannot subscribe topic ${stringifiedTopic}`

        log.error(errMsg)
        return callback(errcode(new Error(errMsg), 'ERR_SUBSCRIBING_TOPIC'))
      }

      this._getLocal(key, callback)
    })
  }

  // Get record from local datastore
  _getLocal (key, callback) {
    this._datastore.get(key, (err, dsVal) => {
      if (err) {
        const errMsg = `local record requested was not found for ${key}`

        log.error(errMsg)
        return callback(errcode(new Error(errMsg), 'ERR_NO_LOCAL_RECORD_FOUND'))
      }

      if (!Buffer.isBuffer(dsVal)) {
        const errMsg = `found record that we couldn't convert to a value`

        log.error(errMsg)
        return callback(errcode(new Error(errMsg), 'ERR_INVALID_RECORD_RECEIVED'))
      }

      callback(null, dsVal)
    })
  }

  // Validate record according to the received validation function
  _validateRecord (value, peerId, callback) {
    if (typeof this._validator !== 'object' || typeof this._validator.validate !== 'function') {
      const errMsg = `validator does not have the validate function`

      log.error(errMsg)
      return callback(errcode(new Error(errMsg), 'ERR_NO_VALIDATE_FUNCTION_FOUND'))
    }

    this._validator.validate(value, peerId, callback)
  }

  // Select the best record according to the received select function.
  _selectRecord (receivedRecord, currentRecord, callback) {
    if (typeof this._validator !== 'object' || typeof this._validator.select !== 'function') {
      const errMsg = `validator does not have the select function`

      log.error(errMsg)
      return callback(errcode(new Error(errMsg), 'ERR_NO_SELECT_FUNCTION_FOUND'))
    }

    this._validator.select(receivedRecord, currentRecord, (err, res) => {
      if (err) {
        log.error(err)
        return callback(err)
      }

      // If the selected was the first (0), it should be stored (true)
      callback(null, res === 0)
    })
  }

  // Verify if the record received through pubsub is better than the one currently stored
  _isBetter (key, val, callback) {
    let receivedRecord

    try {
      receivedRecord = Record.deserialize(val)
    } catch (err) {
      log.error(err)
      return callback(err)
    }

    // validate received record
    this._validateRecord(receivedRecord.value, receivedRecord.author, (err, valid) => {
      // If not valid, it is not better than the one currently available
      if (err || !valid) {
        log.error('record received through pubsub is not valid')
        return
      }

      // Get Local record
      const dsKey = new Key(key)
      this._getLocal(dsKey, (err, res) => {
        // if the old one is invalid, the new one is *always* better
        if (err) {
          return callback(null, false)
        }

        // if the same record, do not need to store
        if (res.equals(val)) {
          return callback(null, false)
        }

        const currentRecord = Record.deserialize(res)

        // verify if the received record should replace the current one
        this._selectRecord(receivedRecord.value, currentRecord.value, callback)
      })
    })
  }

  // handles pubsub subscription messages
  _handleSubscription (msg) {
    const { data, from, topicIDs } = msg
    const key = topicIDs[0]

    // Stop if the message is from the peer (it already stored it while publishing to pubsub)
    if (from === this._peerId.toB58String()) {
      return
    }

    // verify if the received record is better
    this._isBetter(key, data, (err, res) => {
      if (!err && res) {
        this._storeRecord(key, data)
      }
    })
  }

  // add record to datastore
  _storeRecord (key, data) {
    this._datastore.put(key, data, (err) => {
      if (err) {
        log.error(`record for ${key.toString()} could not be stored in the routing`)
        return
      }

      log(`record for ${key.toString()} was stored in the datastore`)
    })
  }
}

exports = module.exports = DatastorePubsub
