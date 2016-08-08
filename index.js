var net = require('net')
var discovery = require('discovery-channel')
var inherits = require('inherits')
var events = require('events')
var duplexify = require('duplexify')

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

Network.prototype.destroy = function () {

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
  var stream = duplexify()

  stream.connecting = false
  stream.peer = null
  stream.tries = 0

  this.connections.push(stream)
  stream.on('close', onclose)

  this._tryConnect(stream)

  function onclose () {
    var i = self.connections.indexOf(stream)
    if (i > -1) self.connections.splice(stream, 1)
  }

  return stream
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
  this.tcp.on('listening', onlistening)
  this.tcp.on('error', onerror)

  this.network = network
  this.name = null

  function onerror (err) {
    self.emit('error', err)
  }

  function onlistening () {
    var key = self.name.toString('hex')
    self.network._lookup[key] = (self.network._lookup[key] || 0) + 1
    self.network.discovery.join(self.name, self.address().port)
    self.emit('listening')
  }

  function onconnection (socket) {
    self.emit('connection', socket)
  }
}

inherits(Server, events.EventEmitter)

Server.prototype.address = function () {
  return this.tcp.address()
}

Server.prototype.listen = function (name, port, onlistening) {
  if (typeof port === 'function') return this.listen(name, 0, port)
  if (onlistening) this.once('listening', onlistening)

  this.name = name
  this.tcp.listen(port || 0)
}
