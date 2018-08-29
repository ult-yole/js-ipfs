'use strict'

const multibase = require('multibase')
const { cidToString } = require('../../../utils/cid')
const print = require('../../utils').print

module.exports = {
  command: 'wantlist [peer]',

  describe: 'Print out all blocks currently on the bitswap wantlist for the local peer.',

  builder: {
    peer: {
      alias: 'p',
      describe: 'Specify which peer to show wantlist for.',
      type: 'string'
    },
    'cid-base': {
      describe: 'Number base to display CIDs in.',
      type: 'string',
      choices: multibase.names
    }
  },

  handler (argv) {
    argv.ipfs.bitswap.wantlist(argv.peer, (err, cids) => {
      if (err) {
        throw err
      }
      cids.forEach((cid) => {
        print(cidToString(cid, argv.cidBase))
      })
    })
  }
}
