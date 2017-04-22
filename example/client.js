var net = require('../')()

var socket = net.connect(process.argv[2] || 'example')

socket.on('peer', function (peer) {
  console.log('(trying to connect to %s:%d)', peer.host, peer.port)
})

socket.on('connect', function () {
  console.log('(connected)')
})

process.stdin.pipe(socket).pipe(process.stdout)
