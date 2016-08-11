var net = require('net')
var discovery = require('discovery-channel')
var inherits = require('inherits')
var events = require('events')
var duplexify = require('duplexify')
var toPort = require('hash-to-port')

module.exports = Network

function Network (opts) {
  if (!(this instanceof Network)) return new Network(opts)
  if (!opts) opts = {}

  var self = this

  this.discovery = discovery(opts)
  this.discovery.on('peer', onpeer)

  this._lookup = {}
  this._swarms = {}

  function onpeer (name, peer) {
    getSwarm(self, name).add(peer)
  }
}

Network.prototype.createServer = function (onconnection) {
  var server = new Server(this)
  if (onconnection) server.on('connection', onconnection)
  return server
}

Network.prototype.connect = function (name) {
  var swarm = getSwarm(this, name)
  return swarm.connect(name)
}

Network.prototype.destroy = function (cb) {
  this.discovery.destroy(cb)
}

function getSwarm (self, name) {
  if (typeof name === 'string') name = Buffer(name)
  var key = name.toString('hex')
  var swarm = self._swarms[key]
  if (swarm) return swarm

  swarm = self._swarms[key] = new Swarm(name)
  if (!self._lookup[key]) self.discovery.join(name)

  return swarm
}

function Swarm (name) {
  this.name = name
  this.key = name.toString('hex')
  this.peersMap = {}
  this.peers = []
  this.connections = []

  this._tick = 0
}

Swarm.prototype.connect = function () {
  var self = this
  var stream = duplexify()

  stream.connecting = false
  stream.peer = null
  stream.tries = 0

  this.connections.push(stream)
  stream.on('close', onclose)

  this._tryConnect(stream)
  return stream

  function onclose () {
    var i = self.connections.indexOf(stream)
    if (i > -1) self.connections.splice(stream, 1)
  }
}

Swarm.prototype.add = function (peer) {
  var id = peer.host + ':' + peer.port

  if (!this.peersMap[id]) {
    this.peersMap[id] = peer
    this.peers.push(peer)
  }

  for (var i = 0; i < this.connections.length; i++) {
    var stream = this.connections[i]
    if (stream.connecting) continue
    this._tryConnect(stream)
  }
}

Swarm.prototype.remove = function (peer) {
  // TODO: add me
}

Swarm.prototype._nextPeer = function () {
  var tries = this.peers.length

  while (tries--) {
    if (this._tick === this.peers.length) this._tick = 0
    var next = this.peers[this._tick++]
    return next
  }

  return null
}

Swarm.prototype._tryConnect = function (stream) {
  var self = this
  var peer = this._nextPeer()
  if (!peer) return

  stream.connecting = true
  stream.peer = peer

  var socket = net.connect(peer.port, peer.host)

  stream.on('close', onstreamclose)
  socket.on('connect', onconnect)
  socket.on('error', socket.destroy)
  socket.on('close', onclose)

  function onstreamclose () {
    socket.destroy()
  }

  function destroy () {
    stream.destroy()
  }

  function onconnect () {
    stream.removeListener('close', onstreamclose)

    stream.setReadable(socket)
    stream.setWritable(socket)

    stream.emit('connect')
    socket.removeListener('close', onclose)
    socket.on('close', destroy)
  }

  function onclose () {
    if (++stream.tries >= 5) {
      stream.destroy(new Error('Could not connect to remote peers'))
      return
    }

    self._tryConnect(stream)
  }
}

function Server (network) {
  events.EventEmitter.call(this)

  var self = this

  this.tcp = net.createServer()
  this.tcp.on('connection', onconnection)
  this.tcp.on('close', onclose)

  this.network = network
  this.name = null

  function onclose () {
    self.emit('close')
  }

  function onconnection (socket) {
    self.emit('connection', socket)
  }
}

inherits(Server, events.EventEmitter)

Server.prototype.address = function () {
  return this.tcp.address()
}

Server.prototype.close = function (cb) {
  if (cb) this.once('close', cb)
  this.network.discovery.leave(this.name, this.address().port)
  this.tcp.close()
}

Server.prototype.listen = function (name, port, cb) {
  if (typeof port === 'function') return this.listen(name, 0, port)
  if (typeof name === 'string') name = Buffer(name)
  if (cb) this.once('listening', cb)
  if (!port) port = 0

  var self = this

  this.name = name

  if (port) {
    this.tcp.on('error', onerror)
    this.tcp.listen(port)
  } else {
    this.tcp.once('listening', onlistening)
    this.tcp.once('error', onlisteningerror)
    this.tcp.listen(toPort(name))
  }

  function onerror (err) {
    self.emit('error', err)
  }

  function onlisteningerror () {
    self.tcp.removeListener('listening', onlistening)
    self.tcp.listen(0)
  }

  function onlistening () {
    var key = self.name.toString('hex')
    self.tcp.removeListener('error', onlisteningerror)
    self.tcp.on('error', onerror)
    self.network._lookup[key] = (self.network._lookup[key] || 0) + 1
    self.network.discovery.join(self.name, self.address().port)
    self.emit('listening')
  }
}
