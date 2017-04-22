var net = require('../')()

var server = net.createServer(function (socket) {
  console.log('(new connection)')
  socket.on('data', function (data) {
    process.stdout.write(data)
  })
  process.stdin.on('data', function (data) {
    socket.write(data)
  })
})

server.listen(process.argv[2] || 'example')

process.on('SIGINT', function () {
  server.close(function () {
    process.exit()
  })
})
