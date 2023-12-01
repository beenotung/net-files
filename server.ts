import express from 'express'
import { print } from 'listening-on'
import socketIO from 'socket.io'
import http from 'http'

let app = express()
let server = http.createServer(app)
let io = new socketIO.Server(server)

// slug -> name -> size
let rooms: Record<string, Record<string, number>> = {}

io.on('connection', socket => {
  socket.on('join', slug => {
    socket.join('has:' + slug)
    let room = rooms[slug]
    if (room) {
      for (let name in room) {
        let size = room[name]
        socket.emit('has', { slug, name, size })
      }
    }
  })
  socket.on('leave', slug => {
    socket.leave('has:' + slug)
  })
  socket.on('has', ({ slug, name, size }) => {
    let room = (rooms[slug] ||= {})
    room[name] = size
    io.to('has:' + slug).emit('has', { slug, name, size })
  })
})

app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

let port = 8100
server.listen(port, () => {
  print(port)
})
