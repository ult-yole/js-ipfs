// Stringify a CID in the requested base, auto-converting to v1 if necessary
function cidToString (cid, base) {
  if (cid.version === 0 && base && base !== 'base58btc') {
    cid = cid.toV1()
  }
  return cid.toBaseEncodedString(base)
}

exports.cidToString = cidToString
