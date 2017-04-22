var net = require('../')()

var socket = net.connect(process.argv[2] || 'example')

process.stdin.pipe(socket).pipe(process.stdout)
