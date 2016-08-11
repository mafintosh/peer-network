var network = require('./')()

if (process.argv[2] === 'connect') {
  var client = network.connect('example-server')
  client.on('connect', function () {
    console.log('client connected')
  })

  client.write('hello world')
  client.on('data', function (data) {
    console.log('data:', data.toString())
    client.destroy()
  })
} else {
  var server = network.createServer()

  server.on('connection', function (connection) {
    console.log('[new connection]')
    connection.pipe(connection)
    connection.on('close', function () {
      console.log('[connected closed]')
    })
  })

  server.listen('example-server', 12345)
}

