import express from 'express'
import { print } from 'listening-on'
import socketIO from 'socket.io'
import http from 'http'
import { join } from 'path'
import { env } from './env'

let app = express()
let server = http.createServer(app)
let io = new socketIO.Server(server)

type FileMeta = {
  size: number
  type: string
  lastModified: number
  hash: string
}
// slug -> name -> FileMeta
let rooms: Record<string, Record<string, FileMeta>> = {}

io.on('connection', socket => {
  socket.on('join', slug => {
    socket.join('slug:' + slug)
    let room = rooms[slug]
    if (room) {
      for (let name in room) {
        let fileMeta = room[name]
        socket.emit('has', { slug, name, ...fileMeta })
      }
    }
  })
  socket.on('leave', slug => {
    socket.leave('slug:' + slug)
  })
  socket.on('has', data => {
    let { slug, name, ...fileMeta } = data
    if (!fileMeta.hash) {
      console.warn('rejecting file announce without hash:', { slug, name })
      return
    }
    let room = (rooms[slug] ||= {})
    room[name] = fileMeta
    io.to('slug:' + slug).emit('has', data)
  })
  socket.on('remove', ({ slug, name }) => {
    let room = rooms[slug]
    if (room) {
      delete room[name]
    }
  })
  function forwardData(event: string) {
    socket.on(event, async data => {
      let sockets = await io.in('slug:' + data.slug).fetchSockets()
      for (let peerSocket of sockets) {
        if (peerSocket.id == socket.id) continue
        peerSocket.emit(event, data)
      }
    })
  }
  forwardData('want')
  forwardData('content')
})

app.use(express.static(join(__dirname, '..', 'public')))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

server.listen(env.PORT, () => {
  print(env.PORT)
})
