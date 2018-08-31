const path = require('path')

const apiPrefix = '/api/v0'

const getRouteForCmd = (cmd, name, obj) => {
  if (!obj.http) {
    throw new Error('No .http object provided')
  }
  if (!obj.cli) {
    throw new Error('No .cli object provided')
  }
  if (!obj.call && (!obj.http || !obj.http.call)) {
    throw new Error('No .call provided')
  }
  const call = obj.http.call || obj.call
  return {
    method: '*',
    path: path.join(apiPrefix, cmd.name, name),
    config: {
      payload: obj.payload,
      pre: obj.http.pre ? [{
        method: obj.http.pre,
        assign: 'args'
      }] : undefined,
      handler: (request, reply) => {
        let firstArg
        if (obj.httpArgs) {
          firstArg = request.pre.args[obj.httpArgs[0]]
          const ipfsNode = request.server.app.ipfs
          call(ipfsNode, firstArg, {}, (err, res) => {
            if (err) {
              return reply({
                Message: 'Error: ' + err,
                Code: 0
              }).code(500)
            }
            let httpRes
            if (obj.http.post) {
              httpRes = obj.http.post(res)
            } else {
              httpRes = res
            }
            if (obj.streamOutput) {
              return reply(httpRes).header('X-Stream-Output', '1')
            } else {
              return reply(httpRes)
            }
          })
        } else {
          const ipfsNode = request.server.app.ipfs
          call(ipfsNode, {}, (err, res) => {
            if (err) {
              return reply({
                Message: 'Error: ' + err,
                Code: 0
              }).code(500)
            }
            let httpRes
            if (obj.http.post) {
              httpRes = obj.http.post(res)
            } else {
              httpRes = res
            }
            if (obj.streamOutput) {
              return reply(httpRes).header('X-Stream-Output', '1')
            } else {
              return reply(httpRes)
            }
          })
        }
      }
    }
  }
}

const getCliForCmd = (obj) => {
  return {
    // TODO if command doesn't exists, use name
    command: obj.cli.command || obj.name,
    description: obj.description,
    builder: obj.cli.builder || function () {
    },
    handler: (argv) => {
      let options = {}
      if (obj.cli.builder) {
        // TODO should support `alias` as well
        options = Object.keys(obj.cli.builder).reduce((acc, curr) => {
          return Object.assign(acc, {[curr]: argv[curr]})
        }, {})
      }

      if (!obj.cli.call && !obj.call) {
        throw new Error('No .call provided')
      }
      const call = obj.cli.call || obj.call
      // const pre = obj.cli.pre ? obj.cli.pre : (argv, callback) => callback(null, argv[0])
      const post = obj.cli.post || function () {}

      // TODO handle different stages better
      // TODO handle arguments better, should splat them
      if (obj.cli.pre) {
        obj.cli.pre(argv, (err, firstArg) => {
          if (err) throw err
          call(argv.ipfs, firstArg, options, (err, res) => {
            if (err) throw err
            post(res, argv.printer)
          })
        })
      } else {
        if (obj.httpArgs) {
          const firstArg = argv[obj.httpArgs[0]]
          call(argv.ipfs, firstArg, options, (err, res) => {
            if (err) {
              throw err
            }
            post(res, argv.printer)
          })
        } else {
          call(argv.ipfs, options, (err, res) => {
            if (err) {
              throw err
            }
            post(res, argv.printer)
          })
        }
      }
    }
  }
}

class Commands {
  constructor () {
    this.commands = []
  }
  add (cmd) {
    this.commands.push(cmd)
  }
  initHTTP (server) {
    const api = server.select('API')

    const routes = this.commands.map((cmd) => {
      const children = cmd.children

      let rootRoute
      if (cmd.root) {
        rootRoute = getRouteForCmd(cmd, '', cmd)
      }

      let childrenRoutes = []
      if (children) {
        childrenRoutes = Object.keys(children).map((childName) => {
          const child = children[childName]
          return getRouteForCmd(cmd, childName, child)
        })
      }
      if (rootRoute) {
        return childrenRoutes.concat(rootRoute)
      } else {
        return childrenRoutes
      }
    })
    routes.forEach((route) => api.route(route))
  }
  initCLI (cli) {
    const cmds = this.commands.map((cmd) => {
      const children = cmd.children
      let childrenCmds = []
      if (children) {
        childrenCmds = Object.keys(children).map((childName) => {
          const child = children[childName]
          if (!child.cli) {
            return false
          }
          return getCliForCmd(child)
        })
      }
      // Root here instead
      const filtered = childrenCmds.filter(a => a)
      const rootCmd = getCliForCmd(cmd)
      rootCmd.builder = (argv) => {
        filtered.forEach(child => argv.command(child))
      }
      return rootCmd
    })
    cmds.forEach(cmd => {
      cli.command(cmd)
    })
    return cmds
  }
}

module.exports = Commands
