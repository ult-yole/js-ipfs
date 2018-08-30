'use strict'

const multibase = require('multibase')
const { cidToString } = require('../../../utils/cid')
const print = require('../../utils').print

module.exports = {
  command: 'stat <key>',

  describe: 'Print information of a raw IPFS block',

  builder: {
    'cid-base': {
      describe: 'Number base to display CIDs in.',
      type: 'string',
      choices: multibase.names
    }
  },

  handler (argv) {
    argv.ipfs.block.stat(argv.key, (err, stats) => {
      if (err) {
        throw err
      }

      print('Key: ' + cidToString(stats.key, argv.cidBase))
      print('Size: ' + stats.size)
    })
  }
}
