'use strict'

const multibase = require('multibase')
const { cidToString } = require('../../../utils/cid')
const print = require('../../utils').print

module.exports = {
  command: 'stat',

  describe: 'Show some diagnostic information on the bitswap agent.',

  builder: {
    'cid-base': {
      describe: 'Number base to display CIDs in.',
      type: 'string',
      choices: multibase.names
    }
  },

  handler (argv) {
    argv.ipfs.bitswap.stat((err, stats) => {
      if (err) {
        throw err
      }

      stats.wantlist = stats.wantlist || []
      stats.peers = stats.peers || []

      print(`bitswap status
  blocks received: ${stats.blocksReceived}
  dup blocks received: ${stats.dupBlksReceived}
  dup data received: ${stats.dupDataReceived}B
  wantlist [${stats.wantlist.length} keys]
    ${stats.wantlist.map((cid) => cidToString(cid, argv.cidBase)).join('\n    ')}
  partners [${stats.peers.length}]
    ${stats.peers.join('\n    ')}`)
    })
  }
}
