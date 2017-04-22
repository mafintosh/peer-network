var hyperdht = require('hyperdht')
var thunky = require('thunky')
var crypto = require('crypto')
var events = require('events')
var addr = require('network-address')
var duplexify = require('duplexify')
var utp = require('utp-native')

module.exports = Network

function Network (opts) {
  if (!(this instanceof Network)) return new Network(opts)
  if (!opts) opts = {}

  this.socket = opts.socket || utp()

  this.dht = hyperdht({
    bootstrap: opts.bootstrap || ['bootstrap1.hyperdht.org'],
    ephemeral: opts.ephemeral !== false,
    socket: this.socket
  })

  var self = this

  this.bind = thunky(function (cb) {
    self.dht.listen(function (err) {
      if (err) return cb(err)
      cb(null, self.dht.address().port)
    })
  })

  this.bind()
}

Network.prototype.connect = function (name) {
  var self = this
  var stream = duplexify()

  this.bind(function (err, port) {
    if (err) return stream.destroy(err)
    self.dht.lookup(hash(name), {localAddress: {port: port, host: addr()}}, function (err, nodes) {
      if (err) return stream.destroy(err)
      loopNodes()

      function loopNodes () {
        var next = nodes.shift()
        if (!next) return stream.destroy(new Error('Could not connect to any peers'))

        var peers = next.localPeers.concat(next.peers)
        loop()

        function loop (err) {
          if (err) return stream.destroy(err)

          var peer = peers.shift()
          if (!peer) return loopNodes()

          stream.emit('peer', peer)
          tryConnect(peer, next.node, function (err) {
            if (err) return loop()

            var socket = self.socket.connect(peer.port, peer.host)
            stream.setReadable(socket)
            stream.setWritable(socket)
            stream.emit('connect')
          })
        }
      }

      function tryConnect (peer, node, cb) {
        self.dht.ping(peer, function (err) {
          if (!err) return cb()
          self.dht.holepunch(peer, node, cb)
        })
      }
    })
  })

  return stream
}

Network.prototype.createServer = function (onconnection) {
  var self = this
  var server = new events.EventEmitter()
  var listening = null

  if (onconnection) {
    server.on('connection', onconnection)
  }

  this.socket.on('connection', function (socket) {
    server.emit('connection', socket)
  })

  if (this.socket._firewalled) {
    this.socket._firewalled = false
    this.socket._handle.onsocket(this.socket._onsocket)
  }

  server.listen = function (name) {
    if (listening) throw new Error('Already listening')
    self.bind(function (err, port) {
      if (err) server.emit('error', err)
      listening = {name: hash(name), port: port, host: addr()}
      self.dht.announce(listening.name, {localAddress: listening}, function (err, nodes) {
        if (err) server.emit('error', err)
        server.emit('listening')
      })
    })
  }

  server.close = function (cb) {
    if (!cb) cb = noop
    if (!listening) return cb()
    self.dht.unannounce(listening.name, {localAddress: listening}, function (err) {
      if (err) return cb(err)
      server.emit('close')
      cb(null)
    })
  }

  return server
}

function noop () {}

function hash (val) {
  return crypto.createHash('sha256').update(val).digest()
}
