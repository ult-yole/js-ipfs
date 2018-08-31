// Tests the implementation of the `command` preparator

const describe = require('mocha').describe
const it = require('mocha').it
const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const Command = require('../src/commands')

const xdescribe = describe.skip
const xit = it.skip

const sampleCliWithChildren = {
  name: 'block',
  children: {
    put: {
      call: () => {},
      http: {},
      cli: {}
    }
  }
}

const sampleCli = {
  name: 'id',
  description: 'Shows IPFS Node ID info',
  call: (self, options, callback) => {
    return callback(null, 'MyNodeID')
  },
  cli: {
    command: 'id',
    post: (id) => {
      return 'MyNodeID from CLI'
    }
  },
  http: {
    post: (id) => {
      return 'MyNodeID from HTTP'
    }
  }
}

const newCmdWithAdd = (toAdd) => {
  const cmd = new Command()
  cmd.add(toAdd)
  return cmd
}

const newCmdWithHttpInit = (toAdd, callback) => {
  const cmd = newCmdWithAdd(toAdd)
  return cmd.initHTTP(mockHTTPApi(callback))
}

const newCmdWithMockReply = (toAdd, mockReply) => {
  const cmd = newCmdWithAdd(toAdd)
  return cmd.initHTTP(mockHTTPApi((res) => {
    res[0].config.handler(mockRequest, mockReply)
  }))
}

const mockHTTPApi = (callback) => {
  const mockApi = {
    route: (actualOutput) => {
      callback(actualOutput)
    }
  }
  return {
    select: () => {
      return mockApi
    }
  }
}
const mockRequest = {
  pre: {
    args: []
  },
  server: {
    app: {
      ipfs: {
        id: 'mytestnode'
      }
    }
  }
}

describe('Commands', () => {
  it('Has right type', () => {
    const cmd = new Command()
    expect(cmd).to.be.an.instanceof(Command)
  })
  describe('HTTP API', () => {
    it('Generates the method + path', (done) => {
      const output = [{
        method: '*',
        path: '/api/v0/id'
      }]

      newCmdWithHttpInit(sampleCli, (actualOutput) => {
        expect(actualOutput[0].method).to.eql(output[0].method)
        expect(actualOutput[0].path).to.eql(output[0].path)
        done()
      })
    })
    it.only('Generates method + path for childrens children', (done) => {
      const output = [{
        method: '*',
        path: '/api/v0/id'
      }, {
        method: '*',
        path: '/api/v0/id/id'
      }, {
        method: '*',
        path: '/api/v0/id/id/id'
      }]

      const secondChild = Object.assign({}, sampleCli)
      const firstChild = Object.assign({}, sampleCli)
      firstChild.children = [secondChild]
      const cli = Object.assign({}, sampleCli)
      cli.children = [firstChild]

      newCmdWithHttpInit(cli, (actualOutput) => {
        console.log(actualOutput)
        expect(actualOutput).to.eql(output)
        done()
      })
    })
  })
  describe('With children', () => {
    describe('HTTP API', () => {
      it('Generates the method + path', (done) => {
        const output = [{
          method: '*',
          path: '/api/v0/block/put'
        }]

        newCmdWithHttpInit(sampleCliWithChildren, (actualOutput) => {
          expect(actualOutput[0].method).to.eql(output[0].method)
          expect(actualOutput[0].path).to.eql(output[0].path)
          done()
        })
      })
      describe('Sets the payload property', () => {
        it('default payload', (done) => {
          newCmdWithHttpInit(sampleCliWithChildren, (output) => {
            expect(output[0].payload).to.eql(undefined)
            done()
          })
        })
        it('custom payload', (done) => {
          const payload = {
            parse: false,
            output: 'stream'
          }
          const cliCmd = Object.assign({}, sampleCliWithChildren)
          cliCmd.children.put.payload = payload

          newCmdWithHttpInit(cliCmd, (output) => {
            expect(output[0].config.payload).to.eql(payload)
            done()
          })
        })
      })
      xdescribe('Sets the post function for formatting', () => {})
      describe('Sets the pre property', () => {
        it('default pre', (done) => {
          newCmdWithHttpInit(sampleCliWithChildren, (output) => {
            expect(output[0].pre).to.eql(undefined)
            done()
          })
        })
        it('custom pre', (done) => {
          const pre = () => {
            return 'testing right function'
          }

          const cliCmd = Object.assign({}, sampleCliWithChildren)
          cliCmd.children.put.http = {
            pre
          }

          newCmdWithHttpInit(cliCmd, (output) => {
            expect(output[0].config.pre[0].method).to.eql(pre)
            expect(output[0].config.pre[0].assign).to.eql('args')
            expect(output[0].config.pre[0].method()).to.eql('testing right function')
            done()
          })
        })
      })
      xdescribe('handling args', () => {
        xit('default no args', () => {})
        xit('one arg', () => {})
        xit('two args', () => {})
      })
      describe('child.call', () => {
        const call = (self, options, callback) => {
          expect(self.id).to.eql(mockRequest.server.app.ipfs.id)
          expect(options).to.eql({})
          callback(null, 'hello world')
        }

        it('calls .call', (done) => {
          const cliCmd = Object.assign({}, sampleCliWithChildren)
          cliCmd.children.put.http = { call }

          newCmdWithMockReply(cliCmd, (httpRes) => {
            expect(httpRes).to.eql('hello world')
            done()
          })
        })
        it('calls .http.call', (done) => {
          const cliCmd = Object.assign({}, sampleCliWithChildren)
          cliCmd.children.put.call = call

          newCmdWithMockReply(cliCmd, (httpRes) => {
            expect(httpRes).to.eql('hello world')
            done()
          })
        })
        xit('streams output', () => {})
        xit('errors if no .call or .http.call', () => {})
      })
    })
    xdescribe('CLI API', () => {})
    xdescribe('Components API', () => {})
  })
})
