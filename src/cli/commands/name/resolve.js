'use strict'

module.exports = {
  command: 'resolve [<name>]',

  describe: 'Resolve IPNS names.',

  builder: {
    nocache: {
      alias: 'n',
      describe: 'Do not use cached entries. Default: false.',
      default: false
    },
    recursive: {
      alias: 'r',
      recursive: 'Resolve until the result is not an IPNS name. Default: false.',
      default: false
    }
  },

  handler (argv) {
    const opts = {
      nocache: argv.nocache,
      recursive: argv.recursive
    }

    argv.ipfs.name.resolve(argv.name, opts, (err, result) => {
      if (err) {
        if (argv.onComplete) {
          return argv.onComplete(err)
        } else {
          throw err
        }
      }

      if (result && result.path) {
        argv.printer(result.path)
      } else {
        argv.printer(result)
      }
      if (argv.onComplete) argv.onComplete()
    })
  }
}
